package it.unibo.scafi.js.controller.local

/**
  * the root trait that describe a command that can be sent to the local simulation
  */
sealed trait SimulationCommand

object SimulationCommand {

  /**
    * the result of command evaluation
    */
  sealed trait Result

  /**
    * the command is executed without errors
    */
  case object Executed extends Result

  /**
    * the command received is not known by the interpreter
    */
  case object Unkown extends Result

  /**
    * bad result from move command. The command is performed but some node can't be moved.
    *
    * @param ids set of elements that can't be moved.
    */
  case class CantMove(ids: Set[String]) extends Result

  /**
    * bad result from the change command. The command is performed byt some sensor can't be changed.
    *
    * @param ids set of ids that can't be changed
    */
  case class CantChange(ids: Set[String]) extends Result

  /**
    * describe the movement of a mode
    *
    * @param positionMap that link a node (described with a string id) with the new position (described by a tuple)
    */
  case class Move(positionMap: Map[String, (Double, Double)]) extends SimulationCommand

  /**
    * describe a command that toggle a boolean sensor.
    *
    * @param sensor the target sensor name
    * @param nodes  the set of ids (identified by the id) in which the sensors are toggled.
    */
  case class ToggleSensor(sensor: String, nodes: Set[String]) extends SimulationCommand

  /**
    * describe a command that change a set of sensor value.
    *
    * @param sensor the target sensor name
    * @param nodes  the set of ids (identified by the id) in which the sensors are changed
    * @param value  to put in the sensor
    */
  case class ChangeSensor(sensor: String, nodes: Set[String], value: Any) extends SimulationCommand

}
