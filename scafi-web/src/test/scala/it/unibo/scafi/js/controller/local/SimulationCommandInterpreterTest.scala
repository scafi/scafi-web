package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.Utils
import it.unibo.scafi.js.controller.local.SimulationCommand.Move

class SimulationCommandInterpreterTest extends SupportTesterLike {
  describe("simulation command interpreter") {
    it("able to change eval move command") {
      val node = "1"
      val position = (100.0, 100.0)
      val moveCommand = Move(Map(node -> position))
      val newGraph = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      succeed
    }
  }
}
