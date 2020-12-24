package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.CommandInterpreter
import it.unibo.scafi.js.controller.local.SimulationCommand._
import it.unibo.scafi.js.utils.JSNumber
import it.unibo.scafi.simulation.SpatialSimulation
import it.unibo.scafi.space.Point2D

import scala.concurrent.Future
import scala.scalajs.js
import scala.scalajs.js.annotation.JSExportAll
import scala.util.{Failure, Success, Try}

/**
  * an interpreter used to eval and act command sent by a input side (e.g. GUI, console,..:).
  * It change the local state of the simulator.
  */
trait SimulationCommandInterpreter
  extends CommandInterpreter[SpatialSimulation#SpaceAwareSimulator, SimulationSideEffect, SimulationCommand, SimulationCommand.Result] {
  self : SimulationSupport =>
  import self.incarnation._
  def execute(command : SimulationCommand) : Future[Result] = Future.successful {
    command match {
      case ChangeSensor(sensor, ids, value) => onChangeSensorValue(sensor, ids, value)
      case Move(positionMap) => onMove(positionMap)
      case ToggleSensor(sensor, nodes) => onToggle(sensor, nodes)
      case _ => Unkown
    }
  }

  private def onMove(positionMap : Map[String, (Double, Double)]) : Result = {
    val toScafiBackend = positionMap.mapValues { case (x, y) => new Point2D(x, y) }
      .mapValues(self.systemConfig.coordinateMapping.toBackend)
    toScafiBackend.foreach { case (id, position : P) => backend.setPosition(id, position)}
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
    val sensors = ids.map(id => id -> Try { backend.localSensor[Any](sensor)(id) })
      .map {
        case (id, Success(value : Boolean)) => id -> Success(value)
        case (id, _) => id -> Failure(new IllegalArgumentException("non boolean value"))
      }
    val toggleSensors = sensors
        .collect { case (id, Success(value)) => id -> value }
        .groupBy { case (_, value) => value }
    val sensorMap = toggleSensors.values
      .flatMap(set => set.map { case (id, value) => id -> Map(sensor -> !value)} )
      .toMap
    val cantChange = sensors.collect { case (id, Failure(_)) => id }
    sideEffectsStream.onNext(SensorChanged(sensorMap))
    toggleSensors.foreach { case (sensorValue, set) => backend.chgSensorValue(sensor, set.map(_._1), ! sensorValue)}
    if(cantChange.isEmpty) Executed else CantChange(cantChange)
  }
}

object SimulationCommandInterpreter {

  /**
    * a facade used to send command via javascript console.
    * @param interpreter the wrapped instance of the interpreter
    */
  @JSExportAll
  class JsConsole(interpreter : SimulationCommandInterpreter) {
    def move(id : String, x : JSNumber, y : JSNumber) : Unit = interpreter.execute(Move(Map(id -> (x, y))))
    def changeSensor(id : String, sensor : String, value : js.Any) : Unit = interpreter.execute(ChangeSensor(sensor, Set(id), value))
    def toggle(id : String, sensor : String) : Unit = interpreter.execute(ToggleSensor(sensor, Set(id)))
  }
}
