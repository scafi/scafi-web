package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.CommandInterpreter
import it.unibo.scafi.js.controller.local.SimulationCommand._
import it.unibo.scafi.js.model.Vec3
import it.unibo.scafi.js.utils.JSNumber

import scala.concurrent.Future
import scala.scalajs.js
import scala.scalajs.js.annotation.JSExportAll
import scala.util.{Failure, Success, Try}

trait SimulationCommandInterpreter
    extends CommandInterpreter[
      SimulationSupport.SimulationBackend,
      SimulationSideEffect,
      SimulationCommand,
      SimulationCommand.Result
    ] {
  self: SimulationSupport with SimulationExecutionPlatform =>

  def execute(command: SimulationCommand): Future[Result] = Future.successful {
    command match {
      case ChangeSensor(sensor, ids, value) => onChangeSensorValue(sensor, ids, value)
      case Move(positionMap) => onMove(positionMap)
      case ToggleSensor(sensor, nodes) => onToggle(sensor, nodes)
      case _ => Unkown
    }
  }

  private def onMove(positionMap: Map[String, (Double, Double)]): Result = {
    val toScafiBackend = positionMap
      .mapValues { case (x, y) => Vec3.from2D(x, y) }
      .mapValues(self.systemConfig.coordinateMapping.toBackend)
      .map { case (id, position) => id -> position }
    toScafiBackend.foreach { case (id, position) => updateBackendPosition(id, position) }
    forwardStandaloneMove(toScafiBackend.toMap)
    sideEffectsStream.onNext(PositionChanged(toScafiBackend.toMap))
    Executed
  }

  private def onChangeSensorValue(sensor: String, ids: Set[String], value: Any): Result = {
    if (ids.isEmpty) {
      warnMissingSensorTargets(sensor)
      return Executed
    }
    backend.chgSensorValue(sensor, ids, value)
    forwardStandaloneSensorChange(sensor, ids, value)
    val sensorMap = ids.map(id => id -> Map(sensor -> value)).toMap
    sideEffectsStream.onNext(SensorChanged(sensorMap))
    Executed
  }

  private def onToggle(sensor: String, ids: Set[String]): Result = {
    if (ids.isEmpty) {
      warnMissingSensorTargets(sensor)
      return Executed
    }
    val sensors = ids
      .map(id => id -> backend.localSensor[Any](sensor)(id))
      .collect { case (id, Some(value: Boolean)) => id -> value }
    val toggleSensors = sensors.groupBy { case (_, value) => value }
    val sensorMap = toggleSensors.values
      .flatMap(set => set.map { case (id, value) => id -> Map(sensor -> !value) })
      .toMap
    toggleSensors.foreach { case (sensorValue, set) =>
      val affectedIds = set.map(_._1)
      backend.chgSensorValue(sensor, affectedIds, !sensorValue)
      forwardStandaloneSensorChange(sensor, affectedIds, !sensorValue)
    }
    sideEffectsStream.onNext(SensorChanged(sensorMap))
    Executed
  }

  private def warnMissingSensorTargets(sensor: String): Unit =
    org.scalajs.dom.console.warn(s"[ScafiWeb] Ignoring sensor command for '$sensor' because no nodes are selected")
}

object SimulationCommandInterpreter {

  @JSExportAll
  class JsConsole(interpreter: SimulationCommandInterpreter) {
    def move(id: String, x: JSNumber, y: JSNumber): Unit =
      interpreter.execute(Move(Map(id -> (x, y))))

    def changeSensor(id: String, sensor: String, value: js.Any): Unit =
      interpreter.execute(ChangeSensor(sensor, Set(id), value))

    def toggle(id: String, sensor: String): Unit =
      interpreter.execute(ToggleSensor(sensor, Set(id)))
  }
}
