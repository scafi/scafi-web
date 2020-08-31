package it.unibo.scafi.js.controller.local
sealed trait SimulationCommand

object SimulationCommand {
  sealed trait Result
  case object Executed extends Result
  case class CantMove(ids : Set[String]) extends Result
  case class CantChange(ids : Set[String]) extends Result

  case class Move(positionMap : Map[String, (Double, Double)]) extends SimulationCommand
  case class ToggleSensor(sensor : String, nodes : Set[String]) extends SimulationCommand
  case class ChangeSensor(sensor : String, nodes : Set[String], value : Any) extends SimulationCommand
}
