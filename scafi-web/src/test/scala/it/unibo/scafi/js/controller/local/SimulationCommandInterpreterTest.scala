package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.local.SimulationCommand.{CantChange, ChangeSensor, Executed, Move, ToggleSensor}

class SimulationCommandInterpreterTest extends SupportTesterLike {
  describe("simulation command interpreter") {
    it("able to eval move command") {
      val node = "1"
      val position = (100.0, 100.0)
      val moveCommand = Move(Map(node -> position))
      val newGraph = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      localPlatform.execute(moveCommand)
      newGraph.map(graph => (graph(node).position.x, graph(node).position.y))
        .map(newPosition => newPosition shouldBe position)
    }
    it("able to eval change command adding new sensor") {
      val node = "1"
      val sensor = "new"
      val value = 10
      val changeCommand = ChangeSensor(sensor, Set(node), value)
      val newGraph = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      localPlatform.execute(changeCommand) map (_ shouldBe Executed)
      newGraph.map(graph => (graph(node).labels(sensor) shouldBe value))
    }

    it("able to eval change command altering old sensor") {
      val node = "1"
      val sensor = "obstacle"
      val value = true
      val changeCommand = ChangeSensor(sensor, Set(node), value)
      val newGraph = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      localPlatform.execute(changeCommand) map (_ shouldBe Executed)
      newGraph.map(graph => (graph(node).labels(sensor) shouldBe value))
    }

    it("able to eval toggle command") {
      val node = "1"
      val sensor = "obstacle"
      val value = true
      val moveCommand = ToggleSensor(sensor, Set(node))
      val newGraph = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      localPlatform.execute(moveCommand) map (_ shouldBe Executed)
      newGraph.map(graph => (graph(node).labels(sensor) shouldBe value))
    }

    it("return changeChange if the sensor wasn't boolean") {
      val wrong = "1"
      val correct = "2"
      val nonExisting = "3"
      val sensorTarget = "aSensor"
      val anyVal = 10
      val nonBooleanCommand = ChangeSensor(sensorTarget, Set(wrong), anyVal)
      val booleanCommand = ChangeSensor(sensorTarget, Set(correct), true)
      val toggleCommand = ToggleSensor(sensorTarget, Set(wrong, correct, nonExisting))
      val lastValue = localPlatform.graphStream.take(3).lastL.runToFuture(monixScheduler)
      localPlatform.execute(nonBooleanCommand).map(_ shouldBe Executed)
          .flatMap(_ => localPlatform.execute(booleanCommand) map (_ shouldBe Executed))
          .flatMap(_ => localPlatform.execute(toggleCommand) map (_ shouldBe CantChange(Set(wrong, nonExisting))) )

      lastValue.map(graph => graph(correct).labels(sensorTarget) shouldBe true)
      lastValue.map(graph => graph(wrong).labels(correct) shouldBe anyVal)
      lastValue.map(graph => graph(nonExisting).labels.contains(sensorTarget) shouldBe false)
    }
  }
}
