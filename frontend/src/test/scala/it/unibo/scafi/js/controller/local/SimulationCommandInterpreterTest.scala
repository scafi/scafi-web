package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.local.SimulationCommand.{ChangeSensor, Executed, Move, ToggleSensor}
import it.unibo.scafi.js.dsl.{BasicWebIncarnation, ScafiInterpreterJs}
import it.unibo.scafi.space.Point3D

class SimulationCommandInterpreterTest extends SupportTesterLike {
  import SimulationCommandInterpreterTest._

  private var forwardingPlatform: ForwardingSupportWrapper = _

  override def beforeEach(): Unit = {
    forwardingPlatform = new ForwardingSupportWrapper()(SupportTesterLike.TestLang)
    localPlatform = forwardingPlatform
  }

  describe("Simulation command interpreter") {
    it("forwards move commands to the active standalone runtime") {
      forwardingPlatform.execute(Move(Map("1" -> (12.0, 24.0)))).map { result =>
        result shouldBe Executed
        forwardingPlatform.forwardedMoves.last shouldBe Map("1" -> Point3D(12.0, 24.0, 0.0))
      }
    }

    it("forwards sensor toggles to the active standalone runtime") {
      forwardingPlatform.execute(ToggleSensor("source", Set("1"))).map { result =>
        result shouldBe Executed
        forwardingPlatform.forwardedSensorChanges.last shouldBe ("source", Set("1"), true)
      }
    }

    it("treats a sensor change without targets as an explicit no-op") {
      forwardingPlatform.execute(ChangeSensor("source", Set.empty, value = true)).map { result =>
        result shouldBe Executed
        forwardingPlatform.forwardedSensorChanges shouldBe empty
        forwardingPlatform.sensorValue("source", "1") shouldBe false
      }
    }
  }
}

object SimulationCommandInterpreterTest {
  class ForwardingSupportWrapper(implicit interpreterJs: ScafiInterpreterJs[BasicWebIncarnation])
      extends SupportTesterLike.SimulationSupportWrapper()(interpreterJs) {
    var forwardedMoves: List[Map[String, Point3D]] = List.empty
    var forwardedSensorChanges: List[(String, Set[String], Any)] = List.empty

    def sensorValue(sensor: String, id: String): Any = backend.localSensor[Any](sensor)(id)

    override protected def forwardStandaloneMove(positionMap: Map[String, Point3D]): Unit = {
      forwardedMoves = forwardedMoves :+ positionMap
    }

    override protected def forwardStandaloneSensorChange(sensor: String, ids: Set[String], value: Any): Unit = {
      forwardedSensorChanges = forwardedSensorChanges :+ ((sensor, ids, value))
    }
  }
}
