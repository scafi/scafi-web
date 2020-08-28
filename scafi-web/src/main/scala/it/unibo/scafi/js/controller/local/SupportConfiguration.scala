package it.unibo.scafi.js.controller.local

import it.unibo.scafi.config.GridSettings
import it.unibo.scafi.js.JSNumber
import it.unibo.scafi.js.WebIncarnation._
import it.unibo.scafi.space.Point3D

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSExport, JSExportAll, JSExportTopLevel}

@JSExportTopLevel("SupportConfiguration")
@JSExportAll
case class SupportConfiguration(network: NetworkConfiguration,
                                neighbour: NeighbourConfiguration,
                                deviceShape: DeviceConfiguration,
                                seed : SimulationSeeds,
                                coordinateMapping : CoordinateMapping = CoordinateMapping.identity)

sealed trait NetworkConfiguration
@JSExportTopLevel("RandomNetwork")
@JSExportAll
case class RandomNetwork(min : JSNumber, max : JSNumber, howMany : Int) extends NetworkConfiguration
@JSExportTopLevel("GridLikeNetwork")
@JSExportAll
case class GridLikeNetwork(rows : Int, cols : Int, stepX : JSNumber, stepY : JSNumber, tolerance : JSNumber) extends NetworkConfiguration {
  def toGridSettings : GridSettings = GridSettings(cols, rows, stepX, stepY, tolerance)
}

trait NeighbourConfiguration
@JSExportTopLevel("SpatialRadius")
@JSExportAll
case class SpatialRadius(range : Double) extends NeighbourConfiguration
@JSExportTopLevel("DeviceConfiguration")
@JSExportAll
case class DeviceConfiguration(sensors : js.Dictionary[Any], initialValues : js.Dictionary[js.Dictionary[Any]] = js.Dictionary())
@JSExportTopLevel("DeviceConfigurationObject")
@JSExportAll
object DeviceConfiguration {
  def standard: DeviceConfiguration = DeviceConfiguration(js.Dictionary("source" -> false, "obstacle" -> false))
  def none: DeviceConfiguration = DeviceConfiguration(js.Dictionary())
}

@JSExportTopLevel("SimulationSeed")
case class SimulationSeeds(@JSExport configSeed: JSNumber = System.currentTimeMillis(),
                           @JSExport simulationSeed: JSNumber = System.currentTimeMillis(),
                           @JSExport randomSensorSeed: JSNumber = System.currentTimeMillis()) {
  def toSeeds : Seeds = Seeds(configSeed.toLong, simulationSeed.toLong, randomSensorSeed.toLong)
}
@JSExportTopLevel("CoordinateMapping")
@JSExportAll
case class CoordinateMapping(toWeb : js.Function1[Point3D, Point3D], toBackend : js.Function1[Point3D, Point3D])
@JSExportTopLevel("CoordinateMappingObject")
@JSExportAll
object CoordinateMapping {
  def identity : CoordinateMapping = CoordinateMapping(point => point, point => point)
}