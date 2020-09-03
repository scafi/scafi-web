package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.utils.JSNumber
import it.unibo.scafi.js.dsl.WebIncarnation._
import it.unibo.scafi.js.controller.CommandInterpreter
import it.unibo.scafi.js.controller.local.SimulationCommand.{ChangeSensor, Executed, Move, Result, ToggleSensor}
import it.unibo.scafi.js.controller.local.SimulationSideEffect.{PositionChanged, SensorChanged}

import scala.concurrent.Future
import scala.scalajs.js
import scala.scalajs.js.annotation.JSExportAll
import scala.util.{Success, Try}
trait SimulationCommandInterpreter
  extends CommandInterpreter[SpaceAwareSimulator, SimulationSideEffect, SimulationCommand, SimulationCommand.Result] {
  self : SimulationSupport =>

  def execute(command : SimulationCommand) : Future[Result] = Future.successful {
    command match {
      case ChangeSensor(sensor, ids, value) => onChangeSensorValue(sensor, ids, value)
      case Move(positionMap) => onMove(positionMap)
      case ToggleSensor(sensor, nodes) => onToggle(sensor, nodes)
      case _ => Executed
    }
  }

  private def onMove(positionMap : Map[String, (Double, Double)]) : Result = {
    val toScafiBackend = positionMap.mapValues { case (x, y) => new P(x, y) }
      .mapValues(self.systemConfig.coordinateMapping.toBackend)
    toScafiBackend.foreach { case (id, position : P) => backend.space.setLocation(id, position)}
    sideEffectsStream.onNext(PositionChanged(toScafiBackend))
    Executed
  }

  private def onChangeSensorValue(sensor : String, ids : Set[String], value : Any) : Result = {
    backend.chgSensorValue(sensor, ids, value)
    val sensorMap = ids.map(id => id -> Map(sensor -> value)).toMap
    sideEffectsStream.onNext(SensorChanged(sensorMap))
    Executed
  }

  private def onToggle(sensor : String, ids : Set[String]) : Result = {
    val toggleSensors = ids.map(id => id -> Try(backend.localSensor[Boolean](sensor)(id)))
        .collect { case (id, Success(value)) => id -> value }
        .groupBy { case (_, value) => value }
    val sensorMap = toggleSensors.values
      .flatMap(set => set.map { case (id, value) => id -> Map(sensor -> !value)} )
      .toMap
    sideEffectsStream.onNext(SensorChanged(sensorMap))
    toggleSensors.foreach { case (sensorValue, set) => backend.chgSensorValue(sensor, set.map(_._1), ! sensorValue)}
    Executed
  }
}

object SimulationCommandInterpreter {
  @JSExportAll
  class JsConsole(interpreter : SimulationCommandInterpreter) {
    def move(id : String, x : JSNumber, y : JSNumber) : Unit = interpreter.execute(Move(Map(id -> (x, y))))
    def changeSensor(id : String, sensor : String, value : js.Any) : Unit = interpreter.execute(ChangeSensor(sensor, Set(id), value))
    def toggle(id : String, sensor : String) : Unit = interpreter.execute(ToggleSensor(sensor, Set(id)))
  }
}
