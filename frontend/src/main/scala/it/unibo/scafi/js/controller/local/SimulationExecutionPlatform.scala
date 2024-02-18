package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.ExecutionPlatform
import it.unibo.scafi.js.controller.local.CompilationServers.isReachable
import it.unibo.scafi.js.controller.local.SimulationExecution.TickBased
import it.unibo.scafi.js.controller.local.SimulationSideEffect.SideEffects
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.controller.scripting.Script.{Javascript, ScaFi, Scala, ScalaEasy}
import it.unibo.scafi.js.dsl.JF1
import it.unibo.scafi.js.model.Movement.{AbsoluteMovement, VectorMovement}
import it.unibo.scafi.js.model.{ActuationData, MatrixLed, MatrixOps, Movement}
import it.unibo.scafi.simulation.SpatialSimulation
import it.unibo.scafi.space.Point2D
import org.scalajs.dom
import org.scalajs.dom.{Event, document, window}
import org.scalajs.dom.ext.Ajax

import scala.concurrent.Future
import scala.concurrent.duration.FiniteDuration
import scala.scalajs.js
import scala.scalajs.js.timers.RawTimers.setTimeout
import scala.util.{Success, Try}

/** the execution platform of a local simulation in web browser. Currently it supports only javascript execution. */
trait SimulationExecutionPlatform
    extends ExecutionPlatform[SpatialSimulation#SpaceAwareSimulator, SimulationSideEffect, SimulationExecution] {
  self: SimulationSupport with SideEffects =>
  import incarnation._
  val sensorNames: incarnation.StandardSensorNames = new incarnation.StandardSensorNames {}
  // TODO add better support
  import scala.concurrent.ExecutionContext.Implicits.global

  val location = document.location

  override def loadScript(script: Script): Future[SimulationExecution] = script match {
    case Javascript(code) =>
      Future.fromTry {
        Try(interpreter.adaptForScafi(code))
          .map(_.asInstanceOf[JF1[CONTEXT, EXPORT]]) // TODO NOT SAFE! FIND ANOTHER WAY
          .map(sideEffectExecution)
      }
    case aggregateClass: ScaFi[AggregateProgram] =>
      Future.fromTry {
        Try(sideEffectExecution(aggregateClass.program))
      }
    case ScalaEasy(code) => remoteRequest(code, easyCompilationUrl)
    case Scala(code) => remoteRequest(code, standardCompilation)
    case _ => Future.failed(new IllegalArgumentException("lang not supported"))
  }
  private def sideEffectExecution(program: js.Function1[CONTEXT, EXPORT]): TickBased = {
    val execution: (Int => Future[Unit]) = batchSize => {
      val execution = Future.fromTry(Try[Unit] {
        val exports = (0 until batchSize).map(_ => backend.exec(program))
        val valueMap = toExportMap(exports)
        handleMatrixChanges(valueMap)
        handleMove(valueMap)
        sideEffectsStream.onNext(ExportProduced(exports))
      })
      execution
    }
    backend.clearExports() // clear export for the new script
    sideEffectsStream.onNext(Invalidated) // invalid old graph value
    TickBased(exec = execution)
  }

  private def toExportMap(exports: Seq[(ID, EXPORT)]): Seq[(ID, Iterable[Any])] = {
    exports.map { case (id, e) => id -> e.root[Any]() }.collect {
      case (id, a: ActuationData) => (id, Seq(a))
      case (id, a: Iterable[_]) => (id, a)
      case (id, a: Product) => (id, a.productIterator.toSeq)
      case (id, a: Any) => (id, Seq(a))
    }
  }

  private def handleMatrixChanges(exports: Seq[(ID, Iterable[Any])]): Unit = {
    val matrixLed = exports.map { case (id, values) => id -> values.collect { case (a: MatrixOps) => a } }.toMap

    val matrices: Map[ID, MatrixLed] = matrixLed
      .filter(_._2.nonEmpty)
      .map { case (id, _) => id -> Try(backend.localSensor[MatrixLed]("matrix")(id)) }
      .collect { case (id, Success(matrix)) => id -> matrix }

    val updates = matrices.map { case (id, matrix) =>
      var currentMatrix: MatrixLed = matrix
      matrixLed(id).foreach(action => currentMatrix = MatrixOps(action, currentMatrix))
      id -> currentMatrix
    }

    updates.foreach { case (id, matrix) => backend.chgSensorValue("matrix", Set(id), matrix) }

    sideEffectsStream.onNext(SensorChanged(updates.map { case (id, matrix) =>
      id -> Map("matrix" -> matrix)
    })) // Todo, use change sensor
  }

  private def handleMove(exports: Seq[(ID, Iterable[Any])]): Unit = {
    val movement = exports.map { case (id, values) => id -> values.collect { case (a: Movement) => a } }.toMap
    movement.foreach { case (id, movements) => movements.foreach(movement => act(id, movement)) }
    sideEffectsStream.onNext(Invalidated)
  }

  private def act(id: ID, movement: Movement): Unit = {
    val position = movement match {
      case AbsoluteMovement(x, y) => Point2D(x, y)
      case VectorMovement(dx, dy) =>
        val oldPos = backend.space.getLocation(id)
        val context = backend.context(id)
        val delta = context.sense[FiniteDuration](sensorNames.LSNS_DELTA_TIME).get.toMillis
        Point2D(dx * delta + oldPos.x, dy * delta + oldPos.y)
    }
    backend.setPosition(id, position)
  }
  private def remoteRequest(code: String, pathGenerator: (String) => String): Future[SimulationExecution] = {
    SupportConfiguration.storeGlobal(this.systemConfig)
    CompilationServers().flatMap { servers =>
      val serverHost = servers.map(server).find(isReachable).getOrElse("")
      Ajax
        .post(pathGenerator(serverHost), Ajax.InputData.str2ajax(code))
        .filter(_.status == 200)
        .map(_.responseText)
        .map { id =>
          js.Dynamic.global.window.storeWorkspace()
          document.body.innerHTML = "" // TODO NOT SAFE
          window.location.href = s"$serverHost/$id"
          null // it never returns
        }
    }
  }

  private def appendScript(id: String, url: String): Unit = {
    val newScript = document.createElement("script").asInstanceOf[dom.html.Script]
    newScript.src = s"$url"
    newScript.`type` = "text/javascript"
    newScript.id = id
    document.body.appendChild(newScript)
  }

  private def prepareBlockly(serverHost: String): Unit = setTimeout(
    () => {
      js.Dynamic.global.clearWorkspace()
      List(
        ("blockly", s"$serverHost/js/scafi-blocks-opt.js"),
        ("blocklyBlocks", s"$serverHost/js/scafi-blocks-utils.js")
      ).foreach { case (id, url) => appendScript(id, url) }
      window.dispatchEvent(new Event("resize"))
    },
    interval = 1000
  )
  private def server(name: String) = s"${location.protocol}//$name"
  private def standardCompilation(url: String) = s"$url/code"
  private def easyCompilationUrl(url: String) = s"$url/code/easy"
}
