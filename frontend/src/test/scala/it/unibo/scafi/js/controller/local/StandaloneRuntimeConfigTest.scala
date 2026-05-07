package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.model.MatrixLed.MatrixMap
import it.unibo.scafi.js.model.Vec3
import org.scalatest.funspec.AnyFunSpec
import org.scalatest.matchers.should.Matchers
import ujson.read

class StandaloneRuntimeConfigTest extends AnyFunSpec with Matchers {
  describe("standalone runtime config") {
    it("serializes a grid configuration using plain runtime descriptors") {
      val config = SupportConfiguration(
        GridLikeNetwork(10, 10, 60, 60, 10),
        SpatialRadius(70),
        DeviceConfiguration(
          sensors = Map(
            "matrix" -> MatrixMap(2, Map((0, 0) -> "#ffffff", (1, 1) -> "#000000")),
            "source" -> false,
            "label" -> "demo"
          ),
          initialValues = Map("1" -> Map("source" -> true))
        ),
        SimulationSeeds(1, 2, 3)
      )

      val json = read(
        StandaloneRuntimeConfig.toJson(
          config,
          positions = Map(
            "1" -> Vec3(12, 34, 0),
            "2" -> Vec3(56, 78, 0)
          )
        )
      )

      json("network")("kind").str shouldBe "grid"
      json("network")("rows").num.toInt shouldBe 10
      json("neighbour")("range").num shouldBe 70
      json("seeds")("configSeed").num shouldBe 1
      json("sensors")("source")("kind").str shouldBe "boolean"
      json("sensors")("source")("value").bool shouldBe false
      json("sensors")("label")("value").str shouldBe "demo"
      json("sensors")("matrix")("dimension").num.toInt shouldBe 2
      json("sensors")("matrix")("pixels").arr should have size 2
      json("initialValues")("1")("source")("value").bool shouldBe true
      json("positions")("1")("x").num shouldBe 12
      json("positions")("1")("y").num shouldBe 34
    }

    it("prefers runtime sensor overrides when serializing current standalone state") {
      val config = SupportConfiguration(
        GridLikeNetwork(1, 1, 60, 60, 0),
        SpatialRadius(70),
        DeviceConfiguration(
          sensors = Map("source" -> false, "label" -> "demo"),
          initialValues = Map("1" -> Map("source" -> true))
        ),
        SimulationSeeds(1, 2, 3)
      )

      val json = read(
        StandaloneRuntimeConfig.toJson(
          config,
          initialValues = Map(
            "1" -> Map("source" -> false, "label" -> "runtime"),
            "2" -> Map("source" -> true)
          )
        )
      )

      json("initialValues")("1")("source")("value").bool shouldBe false
      json("initialValues")("1")("label")("value").str shouldBe "runtime"
      json("initialValues")("2")("source")("value").bool shouldBe true
    }
  }
}
