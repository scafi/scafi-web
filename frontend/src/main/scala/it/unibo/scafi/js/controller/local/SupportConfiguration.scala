package it.unibo.scafi.js.controller.local

import it.unibo.scafi.config.GridSettings
import it.unibo.scafi.js.controller.local.DeviceConfiguration.DeviceKind
import it.unibo.scafi.js.model.MatrixLed
import it.unibo.scafi.js.model.MatrixLed.MatrixMap
import it.unibo.scafi.js.utils.GlobalStore
import it.unibo.scafi.space.Point3D
import org.scalajs.dom.ext.Color
import upickle.default._

import scala.scalajs.js.annotation.{JSExport, JSExportAll, JSExportTopLevel}
import scala.scalajs.js.|
import scala.util.Try

/** the configuration used to initialize/ evolve a locale aggregate simulation.
  *
  * @param network
  *   describe how the node are placed in the world.
  * @param neighbour
  *   describe the neighborhood policy of the simulation.
  * @param deviceShape
  *   describe what type of sensor are placed in each node.
  * @param seed
  *   describe a set of seed used to configure, initialize and execute simulation.
  * @param coordinateMapping
  *   a mapping between two coordinate systems.
  */
@JSExportTopLevel("SupportConfiguration")
@JSExportAll
case class SupportConfiguration(
    network: NetworkConfiguration,
    neighbour: NeighbourConfiguration,
    deviceShape: DeviceConfiguration,
    seed: SimulationSeeds,
    coordinateMapping: CoordinateMapping = Identity
)
object SupportConfiguration {
  val key = new GlobalStore.Key {
    override type Data = String
    override val value: String = "configuration"
  }
  implicit def supportConfigurationRW: ReadWriter[SupportConfiguration] = macroRW[SupportConfiguration]

  def storeGlobal(config: SupportConfiguration): Unit = GlobalStore.put(key)(write(config))

  def loadGlobal(): Try[SupportConfiguration] =
    GlobalStore.get(key).flatMap(elem => Try(read[SupportConfiguration](elem)))
}

/** top level trait to describe a network configuration that tells how node are placed in the world. */
sealed trait NetworkConfiguration
object NetworkConfiguration {
  implicit def networkConfigRW: ReadWriter[NetworkConfiguration] = macroRW[NetworkConfiguration]
  implicit def randomNetwork: ReadWriter[RandomNetwork] = macroRW[RandomNetwork]
  implicit def gridLikeNetwork: ReadWriter[GridLikeNetwork] = macroRW[GridLikeNetwork]
}
/** randomly placed nodes restricted in a defined bounds.
  *
  * @param min
  *   value of coordinate x/ y
  * @param max
  *   value of coordinate x/ y
  * @param howMany
  *   node are placed in the world
  */
@JSExportTopLevel("RandomNetwork")
@JSExportAll
case class RandomNetwork(min: Double, max: Double, howMany: Int) extends NetworkConfiguration

/** a grid link network configuration
  *
  * @param rows
  *   of the grid
  * @param cols
  *   of the grid
  * @param stepX
  *   the delta x of each nodes in the grid
  * @param stepY
  *   the delta y of each nodes in the grid
  * @param tolerance
  *   a factor to make grid more "random", a greater value of tolerance produce bigger entropy in the grid.
  */
@JSExportTopLevel("GridLikeNetwork")
@JSExportAll
case class GridLikeNetwork(rows: Int, cols: Int, stepX: Double, stepY: Double, tolerance: Double)
    extends NetworkConfiguration {
  def toGridSettings: GridSettings = GridSettings(cols, rows, stepX, stepY, tolerance)
}

/** a top level trait that describe the policy of neighbour in a network. */
sealed trait NeighbourConfiguration
object NeighbourConfiguration {
  implicit def neighbourConfigurationRW: ReadWriter[NeighbourConfiguration] = macroRW[NeighbourConfiguration]
  implicit def spatialRadiusRW: ReadWriter[SpatialRadius] = macroRW[SpatialRadius]
}

/** a euclidean strategy that link two nodes based on the distance between them.
  *
  * @param range
  *   the threshold that link two node. If the distance between nodes are less than range, they are considered linked.
  */
@JSExportTopLevel("SpatialRadius")
@JSExportAll
case class SpatialRadius(range: Double) extends NeighbourConfiguration

/** describe the set of sensor installed on each node.
  *
  * @param sensors
  *   a map contains the name and the default value of sensor. e.g. js.Dictionary("source", false) install on each node
  *   the sensor "source" with the value "false".
  * @param initialValues
  *   a map contains the initial values of some node in the network. e.g. js.Dictionary("1" -> js.Dictionary("source",
  *   true)) install on node "1" the sensor "source" with the value "true".
  */
@JSExportTopLevel("DeviceConfiguration")
@JSExportAll
case class DeviceConfiguration(
    sensors: Map[String, DeviceKind],
    initialValues: Map[String, Map[String, DeviceKind]] = Map.empty
) {}

@JSExportTopLevel("DeviceConfigurationObject")
@JSExportAll
object DeviceConfiguration {
  type DeviceKind = String | Double | MatrixLed | Boolean
  upickle.default
  implicit def deviceConfigurationRW: ReadWriter[DeviceConfiguration] = macroRW[DeviceConfiguration]
  implicit def deviceKindRW: ReadWriter[DeviceKind] = upickle.default
    .readwriter[ujson.Value]
    .bimap[DeviceKind](
      elem => {
        def tryWith[T: Writer] = Try(elem.asInstanceOf[T]).map(elem => writeJs(elem))
        tryWith[MatrixMap].orElse(tryWith[Boolean]).orElse(tryWith[Double]).orElse(tryWith[String]).get
      },
      json => {
        def summon[T: Reader]: Try[T] = Try(read[T](json))
        summon[MatrixMap]
          .orElse(summon[Boolean])
          .orElse(summon[Double])
          .orElse(summon[String])
          .get
          .asInstanceOf[DeviceKind]
      }
    )
  val standardDimension = 3
  val standardColor = Color("#bb86fc")
  val standardMatrix = MatrixLed.fill(standardDimension, standardColor.toHex)
  /** @return a configuration in which exist the sensor "source" and "obstacle". */
  def standard: DeviceConfiguration = DeviceConfiguration(
    Map[String, DeviceKind]("matrix" -> standardMatrix, "source" -> false, "obstacle" -> false, "target" -> false)
  )

  /** @return a configuration without any sensor. */
  def none: DeviceConfiguration = DeviceConfiguration(Map("matrix" -> standardMatrix))
}
/** a set of seed used to initialize, configure and execute an aggregate simulation.
  *
  * @param configSeed
  *   a seed used to configure an aggregate network (e.g. for random network).
  * @param simulationSeed
  *   a seed used during the simulation to choose the next node.
  * @param randomSensorSeed
  *   a seed used to give a random value to some sensor.
  */
@JSExportTopLevel("SimulationSeed")
case class SimulationSeeds(
    @JSExport configSeed: Double = System.currentTimeMillis(),
    @JSExport simulationSeed: Double = System.currentTimeMillis(),
    @JSExport randomSensorSeed: Double = System.currentTimeMillis()
)
object SimulationSeeds {
  implicit def simulationSeeds: ReadWriter[SimulationSeeds] = macroRW[SimulationSeeds]
}

/** a logic using to alter the coordinate between frontend space and backed space. */
sealed trait CoordinateMapping {
  /** alter a backend position in the frontend space. */
  def toWeb(point: Point3D): Point3D

  /** alter the front position in the backend space. */
  def toBackend(point: Point3D): Point3D
}

object CoordinateMapping {
  implicit def coordinateMappingRW: ReadWriter[CoordinateMapping] = macroRW[CoordinateMapping]
  implicit def identityRW: ReadWriter[Identity.type] = macroRW[Identity.type]
}

case object Identity extends CoordinateMapping {
  override def toWeb(point: Point3D): Point3D = point

  override def toBackend(point: Point3D): Point3D = point
}
