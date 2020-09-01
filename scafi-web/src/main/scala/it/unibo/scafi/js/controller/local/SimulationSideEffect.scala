package it.unibo.scafi.js.controller.local


import it.unibo.scafi.js.dsl.WebIncarnation._
import it.unibo.scafi.space.Point3D
sealed trait SimulationSideEffect
object SimulationSideEffect {
  case object NewConfiguration extends SimulationSideEffect
  case object Invalidated extends SimulationSideEffect
  case class ExportProduced(elements : Seq[(ID, EXPORT)]) extends SimulationSideEffect
  case class SensorChanged(sensorMap : Map[ID, Map[LSNS, Any]]) extends SimulationSideEffect
  case class PositionChanged(positionMap : Map[ID, Point3D]) extends SimulationSideEffect
}
