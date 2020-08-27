package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.Utils._
sealed trait SimulationExecution {
  def batchSize : Int
  protected val exec : (Int) => Unit
}

object SimulationExecution {
  case class TickBased(batchSize : Int = 1, protected val exec : (Int) => Unit) extends SimulationExecution {
    def tick() : Unit = exec(batchSize)
    def toContinuously(delta : Int = 0) : Continuously = Continuously(batchSize, delta, exec)
  }

  case class Continuously(batchSize : Int = 1, delta : Int = 0, protected val exec : (Int) => Unit) extends SimulationExecution {
    val timer = schedule(delta)({exec(batchSize)})
    def stop() : TickBased = {
      cancel(timer)
      TickBased(batchSize, exec)
    }
  }
}
