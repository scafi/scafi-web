package it.unibo.scafi.js.model

sealed trait Movement extends ActuationData
object Movement {
  case class AbsoluteMovement(x : Double, y : Double) extends Movement
  case class VectorMovement(dx : Double, dy : Double) extends Movement
}
