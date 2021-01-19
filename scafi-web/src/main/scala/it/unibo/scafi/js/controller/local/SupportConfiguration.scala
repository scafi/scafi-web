package it.unibo.scafi.js.controller.local

import it.unibo.scafi.config.GridSettings
import it.unibo.scafi.js.JsConversion
import it.unibo.scafi.js.utils.{GlobalStore, JSNumber}
import it.unibo.scafi.space.Point3D

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSExport, JSExportAll, JSExportTopLevel}
import scala.util.Try

/**
  * the configuration used to initialize/ evolve a locale aggregate simulation.
  *
  * @param network           describe how the node are placed in the world.
  * @param neighbour         describe the neighborhood policy of the simulation.
  * @param deviceShape       describe what type of sensor are placed in each node.
  * @param seed              describe a set of seed used to configure, initialize and execute simulation.
  * @param coordinateMapping a mapping between two coordinate systems.
  */
@JSExportTopLevel("SupportConfiguration")
@JSExportAll
case class SupportConfiguration(network: NetworkConfiguration,
                                neighbour: NeighbourConfiguration,
                                deviceShape: DeviceConfiguration,
                                seed: SimulationSeeds,
                                coordinateMapping: CoordinateMapping = Identity) extends JsConversion {
  override def toJs(): js.Object = { //very fragile... need some alternatives
    js.Dynamic.literal(
      "network" -> network.toJs(),
      "neighbour" -> neighbour.toJs(),
      "deviceShape" -> deviceShape.toJs(),
      "seed" -> seed.toJs(),
      "coordinateMapping" -> coordinateMapping.toJs()
    )
  }
}

object SupportConfiguration {
  private def as[A](o: js.Dynamic): A = o.asInstanceOf[A]

  private def loadNetwork(obj: js.Dynamic): NetworkConfiguration = {
    as[String](obj.tpe) match {
      case "random" => RandomNetwork(as[JSNumber](obj.min), as[JSNumber](obj.max), as[Int](obj.howMany))
      case "grid" => GridLikeNetwork(as[Int](obj.rows), as[Int](obj.cols), as[JSNumber](obj.stepX), as[JSNumber](obj.stepY), as[JSNumber](obj.tolerance))
    }
  }

  private def loadDeviceShape(obj: js.Dynamic): DeviceConfiguration = {
    DeviceConfiguration(as[js.Dictionary[Any]](obj.sensors), as[js.Dictionary[js.Dictionary[Any]]](obj.initialValues))
  }

  private def loadSeed(obj: js.Dynamic): SimulationSeeds = {
    SimulationSeeds(as[JSNumber](obj.config), as[JSNumber](obj.simulation), as[JSNumber](obj.random))
  }

  private def loadNeighbour(obj: js.Dynamic): NeighbourConfiguration = {
    SpatialRadius(as[Double](obj.radius))
  }

  private def loadMapping(obj: js.Dynamic): CoordinateMapping = Identity

  //very fragile... need some alternatives
  def loadFrom(obj: js.Dynamic): Try[SupportConfiguration] = Try {
    SupportConfiguration(
      loadNetwork(obj.network),
      loadNeighbour(obj.neighbour),
      loadDeviceShape(obj.deviceShape),
      loadSeed(obj.seed),
      loadMapping(obj.coordinateMapping),
    )
  }

  def storeGlobal(config: SupportConfiguration): Unit = GlobalStore.put("configuration", config.toJs())

  def loadGlobal(): Try[SupportConfiguration] = GlobalStore.get[js.Dynamic]("configuration").flatMap(loadFrom)
}

/**
  * top level trait to describe a network configuration that tells how node are placed in the world.
  */
sealed trait NetworkConfiguration extends JsConversion

/**
  * randomly placed nodes restricted in a defined bounds.
  *
  * @param min     value of coordinate x/ y
  * @param max     value of coordinate x/ y
  * @param howMany node are placed in the world
  */
@JSExportTopLevel("RandomNetwork")
@JSExportAll
case class RandomNetwork(min: JSNumber, max: JSNumber, howMany: Int) extends NetworkConfiguration {
  override def toJs(): js.Object = js.Dynamic.literal("tpe" -> "random",
    "min" -> min, "max" -> max, "howMany" -> howMany
  )
}

/**
  * a grid link network configuration
  *
  * @param rows      of the grid
  * @param cols      of the grid
  * @param stepX     the delta x of each nodes in the grid
  * @param stepY     the delta y of each nodes in the grid
  * @param tolerance a factor to make grid more "random", a greater value of tolerance produce bigger entropy in the grid.
  */
@JSExportTopLevel("GridLikeNetwork")
@JSExportAll
case class GridLikeNetwork(rows: Int, cols: Int, stepX: JSNumber, stepY: JSNumber, tolerance: JSNumber) extends NetworkConfiguration {
  def toGridSettings: GridSettings = GridSettings(cols, rows, stepX, stepY, tolerance)

  override def toJs(): js.Object = js.Dynamic.literal("tpe" -> "grid",
    "rows" -> rows, "cols" -> cols, "stepX" -> stepX, "stepY" -> stepX, "tolerance" -> tolerance
  )
}

/**
  * a top level trait that describe the policy of neighbour in a network.
  */
trait NeighbourConfiguration extends JsConversion

/**
  * a euclidean strategy that link two nodes based on the distance between them.
  *
  * @param range the threshold that link two node. If the distance between nodes are less than range, they are considered linked.
  */
@JSExportTopLevel("SpatialRadius")
@JSExportAll
case class SpatialRadius(range: Double) extends NeighbourConfiguration {
  override def toJs(): js.Object = js.Dynamic.literal("radius" -> range)
}

/**
  * describe the set of sensor installed on each node.
  *
  * @param sensors       a map contains the name and the default value of sensor. e.g. js.Dictionary("source", false) install
  *                      on each node the sensor "source" with the value "false".
  * @param initialValues a map contains the initial values of some node in the network. e.g. js.Dictionary("1" -> js.Dictionary("source", true))
  *                      install on node "1" the sensor "source" with the value "true".
  */
@JSExportTopLevel("DeviceConfiguration")
@JSExportAll
case class DeviceConfiguration(sensors: js.Dictionary[Any], initialValues: js.Dictionary[js.Dictionary[Any]] = js.Dictionary()) extends JsConversion {
  override def toJs(): js.Object = js.Dynamic.literal(
    "sensors" -> sensors, "initialValues" -> initialValues
  )
}

@JSExportTopLevel("DeviceConfigurationObject")
@JSExportAll
object DeviceConfiguration {
  /**
    * @return a configuration in which exist the sensor "source" and "obstacle".
    */
  def standard: DeviceConfiguration = DeviceConfiguration(js.Dictionary("source" -> false, "obstacle" -> false, "target" -> false))

  /**
    * @return a configuration without any sensor.
    */
  def none: DeviceConfiguration = DeviceConfiguration(js.Dictionary())
}

/**
  * a set of seed used to initialize, configure and execute an aggregate simulation.
  *
  * @param configSeed       a seed used to configure an aggregate network (e.g. for random network).
  * @param simulationSeed   a seed used during the simulation to choose the next node.
  * @param randomSensorSeed a seed used to give a random value to some sensor.
  */
@JSExportTopLevel("SimulationSeed")
case class SimulationSeeds(@JSExport configSeed: JSNumber = System.currentTimeMillis(),
                           @JSExport simulationSeed: JSNumber = System.currentTimeMillis(),
                           @JSExport randomSensorSeed: JSNumber = System.currentTimeMillis()) extends JsConversion {
  override def toJs(): js.Object = js.Dynamic.literal(
    "config" -> configSeed, "simulation" -> simulationSeed, "random" -> randomSensorSeed
  )
}

/**
  * a logic using to alter the coordinate between frontend space and backed space.
  *
  * @param toWeb     alter a backend position in the frontend space.
  * @param toBackend alter the front position in the backend space.
  */
sealed trait CoordinateMapping extends JsConversion {
  def toWeb(point: Point3D): Point3D

  def toBackend(point: Point3D): Point3D
}

object Identity extends CoordinateMapping {
  override def toWeb(point: Point3D): Point3D = point

  override def toBackend(point: Point3D): Point3D = point

  override def toJs(): js.Object = js.Dynamic.literal {
    "tpe" -> "identity"
  }
}
