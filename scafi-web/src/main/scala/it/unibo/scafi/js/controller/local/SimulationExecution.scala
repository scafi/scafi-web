package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.Utils._

/**
  * the root trait of a simulator run. It can be "Tick" (i.e. the simulation go on by user click) or
  * a "Deamon" (i.e. the simulation go on by itself in background)
  */
sealed trait SimulationExecution {
  /**
    * define how many element are processed during a simulation step
    */
  def batchSize : Int

  /**
    * internal representation used to go on in the simulation
    */
  protected val exec : (Int) => Unit
}

object SimulationExecution {

  /**
    * the execution is controlled externally by calling a method (tick).
    * @param batchSize how many element are processed during a simulation step
    */
  case class TickBased(batchSize : Int = 1, protected val exec : (Int) => Unit) extends SimulationExecution {
    /**
      * produce a side effect calling exec with the batch size
      */
    def tick() : Unit = exec(batchSize)

    /**
      * turn tick based execution in a daemon one.
      * @param delta the period of execution
      * @param batchSize how many element are processed during a simulation step
      * @return the new instance of execution
      */
    def toDaemon(delta : Int = 0, batchSize : Int = this.batchSize) : Daemon = Daemon(batchSize, delta, exec)

    /**
      * alter the batch size of the current execution
      * @return the new instance of execution
      */
    def withBatchSize(batchSize : Int) : TickBased = this.copy(batchSize = batchSize)
  }

  /**
    * the execution is controlled internally with a certain period (delta). It used internally javascript timers.
    * @param batchSize how many element are processed during a simulation step
    * @param delta the execution period
    */
  case class Daemon(batchSize : Int = 1, delta : Int = 0, protected val exec : (Int) => Unit) extends SimulationExecution {
    private val timer = schedule(delta){exec(batchSize)}

    /**
      * stop current Daemon and turn to "Tick" based execution
      * @return the execution instance
      */
    def stop() : TickBased = {
      cancel(timer)
      TickBased(batchSize, exec)
    }
  }
}
