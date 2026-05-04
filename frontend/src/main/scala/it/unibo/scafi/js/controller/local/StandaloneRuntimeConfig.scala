package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.local.DeviceConfiguration.DeviceKind
import it.unibo.scafi.js.model.MatrixLed
import it.unibo.scafi.js.model.MatrixLed.MatrixMap
import it.unibo.scafi.space.Point3D
import ujson.{Arr, Bool, Num, Obj, Str, Value}

object StandaloneRuntimeConfig {
  private val gridKind = "grid"
  private val randomKind = "random"

  def toJson(
      config: SupportConfiguration,
      positions: Map[String, Point3D] = Map.empty,
      initialValues: Map[String, Map[String, Any]] = Map.empty
  ): String = {
    val runtimeInitialValues = if (initialValues.nonEmpty) initialValues else config.deviceShape.initialValues
    val json = Obj(
      "network" -> encodeNetwork(config.network),
      "neighbour" -> encodeNeighbour(config.neighbour),
      "sensors" -> encodeDeviceMap(config.deviceShape.sensors),
      "initialValues" -> encodeInitialValues(runtimeInitialValues),
      "seeds" -> encodeSeeds(config.seed)
    )
    if (positions.nonEmpty) {
      json("positions") = encodePositions(positions)
    }
    json.render()
  }

  private def encodeNetwork(network: NetworkConfiguration): Value = network match {
    case GridLikeNetwork(rows, cols, stepX, stepY, tolerance) =>
      Obj(
        "kind" -> Str(gridKind),
        "rows" -> Num(rows),
        "cols" -> Num(cols),
        "stepX" -> Num(stepX),
        "stepY" -> Num(stepY),
        "tolerance" -> Num(tolerance)
      )
    case RandomNetwork(min, max, howMany) =>
      Obj(
        "kind" -> Str(randomKind),
        "min" -> Num(min),
        "max" -> Num(max),
        "howMany" -> Num(howMany)
      )
  }

  private def encodeNeighbour(neighbour: NeighbourConfiguration): Value = neighbour match {
    case SpatialRadius(range) => Obj("range" -> Num(range))
  }

  private def encodeSeeds(seeds: SimulationSeeds): Value = Obj(
    "configSeed" -> Num(seeds.configSeed),
    "simulationSeed" -> Num(seeds.simulationSeed),
    "randomSensorSeed" -> Num(seeds.randomSensorSeed)
  )

  private def encodeInitialValues(initialValues: Map[String, Map[String, Any]]): Value = {
    val result = Obj()
    initialValues.toSeq.sortBy(_._1).foreach { case (nodeId, values) =>
      result(nodeId) = encodeDeviceMap(values)
    }
    result
  }

  private def encodePositions(positions: Map[String, Point3D]): Value = {
    val result = Obj()
    positions.toSeq.sortBy(_._1).foreach { case (nodeId, point) =>
      result(nodeId) = Obj(
        "x" -> Num(point.x),
        "y" -> Num(point.y)
      )
    }
    result
  }

  private def encodeDeviceMap(values: Map[String, Any]): Value = {
    val result = Obj()
    values.toSeq.sortBy(_._1).foreach { case (name, value) =>
      result(name) = encodeDeviceValue(value)
    }
    result
  }

  private def encodeDeviceValue(value: Any): Value = value match {
    case value: String => Obj("kind" -> Str("string"), "value" -> Str(value))
    case value: Int => Obj("kind" -> Str("double"), "value" -> Num(value.toDouble))
    case value: Double => Obj("kind" -> Str("double"), "value" -> Num(value))
    case value: Boolean => Obj("kind" -> Str("boolean"), "value" -> Bool(value))
    case MatrixMap(dimension, pixels) =>
      Obj(
        "kind" -> Str("matrix"),
        "dimension" -> Num(dimension),
        "pixels" -> Arr(
          pixels.toSeq.sortBy { case ((i, j), _) => (i, j) }.map { case ((i, j), color) =>
            Arr(Arr(Num(i), Num(j)), Str(color))
          }: _*
        )
      )
    case matrix: MatrixLed => encodeDeviceValue(MatrixMap(matrix.dimension, (0 until matrix.dimension).flatMap { i =>
        (0 until matrix.dimension).flatMap { j =>
          matrix.get(i, j).toOption.map(color => (i, j) -> color)
        }
      }.toMap))
    case other => Obj("kind" -> Str("string"), "value" -> Str(other.toString))
  }
}