package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.ExecutionPlatform
import it.unibo.scafi.js.controller.local.SimulationExecution.TickBased
import it.unibo.scafi.js.controller.local.SimulationSideEffect.SideEffects
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.controller.scripting.Script.{Scala, ScalaEasy}
import it.unibo.scafi.js.model.MatrixLed.MatrixMap
import it.unibo.scafi.js.model.Movement.{AbsoluteMovement, VectorMovement}
import it.unibo.scafi.js.model.{ActuationData, MatrixLed, MatrixOps, Movement, Vec3}
import it.unibo.scafi.js.view.dynamic.EditorSection.{ScalaModeEasy, ScalaModeFull}
import monix.execution.Cancelable
import org.scalajs.dom

import scala.concurrent.{Future, Promise}
import scala.concurrent.duration.FiniteDuration
import scala.scalajs.js
import scala.util.{Failure, Success, Try}

trait SimulationExecutionPlatform
    extends ExecutionPlatform[SimulationSupport.SimulationBackend, SimulationSideEffect, SimulationExecution] {
  self: SimulationSupport with SideEffects =>

  import scala.concurrent.ExecutionContext.Implicits.global

  protected val defaultMovementDeltaMillis: Long = 50L

  var graphStreamSub: Option[Cancelable] = None
  var renderStandalone: Option[js.Dynamic => Unit] = None

  private var standaloneGeneration = 0
  private var standaloneSession: Option[StandaloneRuntimeSession] = None

  private final case class StandaloneRuntimeSession(generation: Int, runtime: js.Dynamic) {
    private var started = false
    private var pendingPositions: Map[String, Vec3] = Map.empty
    private var pendingSensors: Map[String, Map[String, Any]] = Map.empty

    private def isCurrent: Boolean = standaloneSession.exists(_.generation == generation)

    def initialize(): Unit = if (isCurrent) {
      started = false
      try {
        runtime.loadAndInit(currentStandaloneRuntimeConfigJson(pendingPositions, pendingSensors))
        emitState(runtime)
      } catch {
        case e: Throwable =>
          org.scalajs.dom.console.error("[ScafiWeb] Standalone loadAndInit failed:", e.toString)
      }
    }

    def tick(): Unit = if (isCurrent) {
      started = true
      runtime.tick()
      emitState(runtime)
    }

    def setPositions(positionMap: Map[String, Vec3]): Unit = if (isCurrent && positionMap.nonEmpty) {
      pendingPositions = pendingPositions ++ positionMap
      if (started) {
        positionMap.foreach { case (id, point) =>
          runtime.setPosition(id, point.x, point.y)
        }
        emitState(runtime)
      } else {
        initialize()
      }
    }

    def setSensorValue(sensor: String, ids: Set[String], value: Any): Unit = if (isCurrent && ids.nonEmpty) {
      pendingSensors = ids.foldLeft(pendingSensors) { (acc, id) =>
        acc.updated(id, acc.getOrElse(id, Map.empty) + (sensor -> value))
      }
      if (started) {
        runtime.setSensorValue(sensor, js.Array(ids.toSeq: _*), toJsValue(value))
        emitState(runtime)
      } else {
        initialize()
      }
    }

    def dispose(): Unit = {
      try {
        runtime.dispose()
      } catch {
        case _: Throwable =>
      }
    }
  }

  def clearStandaloneSession(): Unit = {
    standaloneGeneration += 1
    val current = standaloneSession
    standaloneSession = None
    current.foreach(_.dispose())
  }

  protected def forwardStandaloneMove(positionMap: Map[String, Vec3]): Unit = {
    standaloneSession.foreach(_.setPositions(positionMap))
  }

  protected def forwardStandaloneSensorChange(sensor: String, ids: Set[String], value: Any): Unit =
    standaloneSession.foreach(_.setSensorValue(sensor, ids, value))

  override def loadScript(script: Script): Future[SimulationExecution] = script match {
    case ScalaEasy(code) => loadViaScastie(code, ScalaModeEasy)
    case Scala(code) => loadViaScastie(code, ScalaModeFull)
    case _ => Future.failed(new IllegalArgumentException("lang not supported"))
  }

  private def loadViaScastie(code: String, mode: it.unibo.scafi.js.view.dynamic.EditorSection.Mode): Future[SimulationExecution] = {
    clearStandaloneSession()
    SupportConfiguration.storeGlobal(this.systemConfig)
    val generation = nextStandaloneGeneration()
    val promise = Promise[SimulationExecution]()
    ScastieClient.compile(code, mode).onComplete {
      case Success(jsContent) if generation != standaloneGeneration =>
        promise.tryFailure(new RuntimeException("Standalone load superseded by a newer request"))
      case Success(jsContent) =>
        val len = if (jsContent == null) 0 else jsContent.length
        if (len < 1000) {
          promise.tryFailure(new RuntimeException(s"Compilation returned short content ($len bytes)"))
        } else {
          try {
            val runtime = evaluateStandaloneRuntime(jsContent)
            if (js.isUndefined(runtime)) {
              promise.tryFailure(new RuntimeException("scafiStandalone not defined"))
            } else if (generation != standaloneGeneration) {
              promise.tryFailure(new RuntimeException("Standalone load superseded by a newer request"))
            } else {
              val session = StandaloneRuntimeSession(generation, runtime.asInstanceOf[js.Dynamic])
              standaloneSession = Some(session)
              session.initialize()
              promise.trySuccess(TickBased(exec = _ => Future.fromTry(Try[Unit] {
                session.tick()
              })))
            }
          } catch {
            case e: Throwable => promise.tryFailure(e)
          }
        }
      case Failure(err) =>
        promise.tryFailure(err)
    }
    promise.future
  }

  private def evaluateStandaloneRuntime(jsContent: String): js.Any =
    js.Dynamic.global
      .selectDynamic("eval")
      .asInstanceOf[js.Function1[String, js.Any]](
        s"(function(){\n$jsContent\n;return typeof scafiStandalone !== 'undefined' ? scafiStandalone : undefined;\n})()"
      )

  private def emitState(runtime: js.Dynamic): Unit = {
    try {
      val state = runtime.getState()
      if (state != null && !js.isUndefined(state)) {
        syncStandaloneState(state.asInstanceOf[js.Dynamic])
        renderStandalone.foreach(render => render(state))
      }
    } catch {
      case e: Throwable => org.scalajs.dom.console.error("[ScafiWeb] emitState:", e.toString)
    }
  }

  private def nextStandaloneGeneration(): Int = {
    standaloneGeneration += 1
    standaloneGeneration
  }

  private def currentStandalonePositions(): Map[String, Vec3] = {
    backend.devs.map { case (id, dev) => id -> dev.pos }.toMap
  }

  private def currentStandaloneSensorValues(): Map[String, Map[String, Any]] = {
    val trackedSensors = trackedStandaloneSensorNames
    backend.devs.toSeq
      .map { case (id, device) =>
        id -> device.lsns.collect { case (sensorName, value) if trackedSensors.contains(sensorName) =>
          sensorName -> value
        }
      }
      .collect { case (id, sensors) if sensors.nonEmpty => id -> sensors }
      .toMap
  }

  private def currentStandaloneRuntimeConfigJson(
      positionOverrides: Map[String, Vec3] = Map.empty,
      sensorOverrides: Map[String, Map[String, Any]] = Map.empty
  ): String =
    StandaloneRuntimeConfig.toJson(
      this.systemConfig,
      currentStandalonePositions() ++ positionOverrides,
      sensorOverrides
    )

  private def mergeStandaloneSensorValues(
      base: Map[String, Map[String, Any]],
      overrides: Map[String, Map[String, Any]]
  ): Map[String, Map[String, Any]] =
    overrides.foldLeft(base) { case (acc, (id, values)) =>
      acc.updated(id, acc.getOrElse(id, Map.empty) ++ values)
    }

  private def trackedStandaloneSensorNames: Set[String] =
    systemConfig.deviceShape.sensors.keySet ++ systemConfig.deviceShape.initialValues.valuesIterator.flatMap(_.keys)

  private def syncStandaloneState(state: js.Dynamic): Unit = {
    selectArray(state, "nodes").foreach { rawNode =>
      val node = rawNode.asInstanceOf[js.Dynamic]
      for {
        id <- select(node, "id").map(_.toString)
        x <- selectDouble(node, "x")
        y <- selectDouble(node, "y")
      } {
        updateBackendPosition(id, Vec3.from2D(x, y))
        select(node, "labels").foreach(labels => syncStandaloneSensors(id, labels.asInstanceOf[js.Dynamic]))
      }
    }
  }

  protected def updateBackendPosition(id: String, position: Vec3): Unit = {
    backend.setPosition(id, position)
  }

  private def syncStandaloneSensors(id: String, labels: js.Dynamic): Unit = {
    trackedStandaloneSensorNames.foreach { sensorName =>
      select(labels, sensorName).flatMap(decodeStandaloneValue).foreach { value =>
        backend.chgSensorValue(sensorName, Set(id), value)
      }
    }
  }

  private def decodeStandaloneValue(value: js.Any): Option[Any] = {
    if (value == null || js.isUndefined(value)) {
      None
    } else {
      parseMatrix(value).orElse {
        value.asInstanceOf[Any] match {
          case number: Int => Some(number.toDouble)
          case other => Some(other)
        }
      }
    }
  }

  private def parseMatrix(value: js.Any): Option[MatrixMap] = {
    if (value == null || js.isUndefined(value) || js.typeOf(value) != "object" || js.Array.isArray(value)) {
      None
    } else {
      val matrix = value.asInstanceOf[js.Dynamic]
      val maybeDimension = selectDouble(matrix, "dimension").map(_.toInt)
      val maybePixels = select(matrix, "pixels")
      (maybeDimension, maybePixels) match {
        case (Some(dimension), Some(rawPixels)) =>
          val pixels = selectArray(rawPixels.asInstanceOf[js.Dynamic], identity = true).flatMap {
            case pixel: js.Array[js.Any @unchecked] if pixel.length >= 2 =>
              pixel(0) match {
                case coordinates: js.Array[js.Any @unchecked] if coordinates.length >= 2 =>
                  Some(((toInt(coordinates(0)), toInt(coordinates(1))), pixel(1).toString))
                case _ => None
              }
            case _ => None
          }.toMap
          if (pixels.nonEmpty) Some(MatrixMap(dimension, pixels.toMap[(Int, Int), String])) else None
        case _ => None
      }
    }
  }

  private def select(value: js.Dynamic, key: String): Option[js.Any] = {
    val selected = value.selectDynamic(key)
    if (selected == null || js.isUndefined(selected)) None else Some(selected.asInstanceOf[js.Any])
  }

  private def selectArray(value: js.Dynamic, key: String = "", identity: Boolean = false): Seq[js.Any] = {
    val raw = if (identity) value.asInstanceOf[js.Any] else select(value, key).orNull
    raw match {
      case array: js.Array[js.Any @unchecked] => array.toSeq
      case _ => Seq.empty
    }
  }

  private def selectDouble(value: js.Dynamic, key: String): Option[Double] =
    select(value, key).map { jsValue =>
      jsValue.asInstanceOf[Any] match {
        case number: Double => number
        case number: Int => number.toDouble
        case other => other.toString.toDouble
      }
    }

  private def toInt(value: js.Any): Int = value.asInstanceOf[Any] match {
    case number: Double => number.toInt
    case number: Int => number
    case other => other.toString.toDouble.toInt
  }

  private def toJsValue(value: Any): js.Any = value match {
    case number: Int => number.toDouble.asInstanceOf[js.Any]
    case number: Double => number.asInstanceOf[js.Any]
    case bool: Boolean => bool.asInstanceOf[js.Any]
    case string: String => string.asInstanceOf[js.Any]
    case MatrixMap(dimension, pixels) =>
      val encoded = js.Dynamic.literal()
      val jsPixels = js.Array[js.Any]()
      pixels.toSeq.sortBy { case ((i, j), _) => (i, j) }.foreach { case ((i, j), color) =>
        jsPixels.push(js.Array(js.Array(i.asInstanceOf[js.Any], j.asInstanceOf[js.Any]), color.asInstanceOf[js.Any]))
      }
      encoded.updateDynamic("dimension")(dimension)
      encoded.updateDynamic("pixels")(jsPixels)
      encoded.asInstanceOf[js.Any]
    case other => other.asInstanceOf[js.Any]
  }
}
