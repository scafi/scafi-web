package it.unibo.scafi.js.controller.local

import it.unibo.scafi.config.GridSettings
import it.unibo.scafi.js.JSNumber
import it.unibo.scafi.js.WebIncarnation._
import it.unibo.scafi.space.Point3D

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSExport, JSExportAll, JSExportTopLevel}

/**
  * the configuration used to initialize/ evolve a locale aggregate simulation.
  * @param network describe how the node are placed in the world.
  * @param neighbour describe the neighborhood policy of the simulation.
  * @param deviceShape describe what type of sensor are placed in each node.
  * @param seed describe a set of seed used to configure, initialize and execute simulation.
  * @param coordinateMapping a mapping between two coordinate systems.
  */
@JSExportTopLevel("SupportConfiguration")
@JSExportAll
case class SupportConfiguration(network: NetworkConfiguration,
                                neighbour: NeighbourConfiguration,
                                deviceShape: DeviceConfiguration,
                                seed : SimulationSeeds,
                                coordinateMapping : CoordinateMapping = CoordinateMapping.identity)

/**
  * top level trait to describe a network configuration that tells how node are placed in the world.
  */
sealed trait NetworkConfiguration
/**
  * randomly placed nodes restricted in a defined bounds.
  * @param min value of coordinate x/ y
  * @param max value of coordinate x/ y
  * @param howMany node are placed in the world
  */
@JSExportTopLevel("RandomNetwork")
@JSExportAll
case class RandomNetwork(min : JSNumber, max : JSNumber, howMany : Int) extends NetworkConfiguration
/**
  * a grid link network configuration
  * @param rows of the grid
  * @param cols of the grid
  * @param stepX the delta x of each nodes in the grid
  * @param stepY the delta y of each nodes in the grid
  * @param tolerance a factor to make grid more "random", a greater value of tolerance produce bigger entropy in the grid.
  */
@JSExportTopLevel("GridLikeNetwork")
@JSExportAll
case class GridLikeNetwork(rows : Int, cols : Int, stepX : JSNumber, stepY : JSNumber, tolerance : JSNumber) extends NetworkConfiguration {
  def toGridSettings : GridSettings = GridSettings(cols, rows, stepX, stepY, tolerance)
}
/**
  * a top level trait that describe the policy of neighbour in a network.
  */
trait NeighbourConfiguration
/**
  * a euclidean strategy that link two nodes based on the distance between them.
  * @param range the threshold that link two node. If the distance between nodes are less than range, they are considered linked.
  */
@JSExportTopLevel("SpatialRadius")
@JSExportAll
case class SpatialRadius(range : Double) extends NeighbourConfiguration
/**
  * describe the set of sensor installed on each node.
  * @param sensors a map contains the name and the default value of sensor. e.g. js.Dictionary("source", false) install
  *                on each node the sensor "source" with the value "false".
  * @param initialValues a map contains the initial values of some node in the network. e.g. js.Dictionary("1" -> js.Dictionary("source", true))
  *                      install on node "1" the sensor "source" with the value "true".
  */
@JSExportTopLevel("DeviceConfiguration")
@JSExportAll
case class DeviceConfiguration(sensors : js.Dictionary[Any], initialValues : js.Dictionary[js.Dictionary[Any]] = js.Dictionary())
@JSExportTopLevel("DeviceConfigurationObject")
@JSExportAll
object DeviceConfiguration {
  /**
    * @return a configuration in which exist the sensor "source" and "obstacle".
    */
  def standard: DeviceConfiguration = DeviceConfiguration(js.Dictionary("source" -> false, "obstacle" -> false))

  /**
    * @return a configuration without any sensor.
    */
  def none: DeviceConfiguration = DeviceConfiguration(js.Dictionary())
}
/**
  * a set of seed used to initialize, configure and execute an aggregate simulation.
  * @param configSeed a seed used to configure an aggregate network (e.g. for random network).
  * @param simulationSeed a seed used during the simulation to choose the next node.
  * @param randomSensorSeed a seed used to give a random value to some sensor.
  */
@JSExportTopLevel("SimulationSeed")
case class SimulationSeeds(@JSExport configSeed: JSNumber = System.currentTimeMillis(),
                           @JSExport simulationSeed: JSNumber = System.currentTimeMillis(),
                           @JSExport randomSensorSeed: JSNumber = System.currentTimeMillis()) {
  def toSeeds : Seeds = Seeds(configSeed.toLong, simulationSeed.toLong, randomSensorSeed.toLong)
}
/**
  * a logic using to alter the coordinate between frotend space and backed space.
  * @param toWeb alter a backend position in the frontend space.
  * @param toBackend alter the front position in the backend space.
  */
@JSExportTopLevel("CoordinateMapping")
@JSExportAll
case class CoordinateMapping(toWeb : js.Function1[Point3D, Point3D], toBackend : js.Function1[Point3D, Point3D])
@JSExportTopLevel("CoordinateMappingObject")
@JSExportAll
object CoordinateMapping {
  /**
    * @return the identity strategy, the backend space and frontend space are the same.
    */
  def identity : CoordinateMapping = CoordinateMapping(point => point, point => point)
}