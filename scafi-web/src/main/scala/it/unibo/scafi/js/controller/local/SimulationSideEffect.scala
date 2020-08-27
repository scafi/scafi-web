package it.unibo.scafi.js.controller.local


import it.unibo.scafi.js.WebIncarnation._
sealed trait SimulationSideEffect
object SimulationSideEffect {
  case object NewConfiguration extends SimulationSideEffect
  case object Invalidated extends SimulationSideEffect
  case class ExportProduced(elements : Seq[(ID, EXPORT)]) extends SimulationSideEffect
  case class SensorChanged(id : ID, name : LSNS, value : Any) extends SimulationSideEffect
  case class PositionChanged(id : ID, position : P) extends SimulationSideEffect
}
