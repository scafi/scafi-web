package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.model.Vec3
/** the root trait of all side effect that can be captured in a local simulated aggregate system. This concept is used
  * to process event in order and to change the graph model consequently. It allow a "declarative" way to manage side
  * effect in a simulation.
  */
sealed trait SimulationSideEffect
object SimulationSideEffect {
  trait SideEffects {
    self: SimulationSupport =>
    /** current backend has been initialized with a new configuration */
    case object NewConfiguration extends SimulationSideEffect

    /** a general side effect, current backend have a general mutation that must be handled */
    case object Invalidated extends SimulationSideEffect

    /** a simulation round alter the aggregate system, the graph model should be changed consequently.
      * @param elements
      *   a sequence of ID and export value
      */
    case class ExportProduced(elements: Seq[(String, Any)]) extends SimulationSideEffect

    /** a side effect bring to a changes in a set of sensor. The graph model should be updated.
      * @param sensorMap
      *   a map that link each node with the sensor changed (a map that link each sensor name with the new value)
      */
    case class SensorChanged(sensorMap: Map[String, Map[String, Any]]) extends SimulationSideEffect

    /** some nodes are moved in the world. The graph model should be altered to make the two world sync.
      * @param positionMap
      *   a map that link each node with the new position
      */
    case class PositionChanged(positionMap: Map[String, Vec3]) extends SimulationSideEffect
  }
}
