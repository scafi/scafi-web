package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.Utils
import it.unibo.scafi.js.controller.local.SupportTesterLike.SimulationSupportWrapper
import it.unibo.scafi.js.utils.Execution
import org.scalatest.BeforeAndAfterEach
import org.scalatest.funspec.AsyncFunSpec
import org.scalatest.matchers.should.Matchers

class SupportTesterLike extends AsyncFunSpec with Matchers with BeforeAndAfterEach {
  protected var localPlatform : SimulationSupportWrapper = _
  override implicit val executionContext = scala.concurrent.ExecutionContext.Implicits.global
  protected val monixScheduler = Execution.timeoutBasedScheduler
  override def beforeEach(): Unit = {
    localPlatform = new SimulationSupportWrapper()
  }
}

object SupportTesterLike {
  class SimulationSupportWrapper extends SimulationSupport(standardConfig)
    with SimulationCommandInterpreter
    with SimulationExecutionPlatform {
    def publish(sideEffect : SimulationSideEffect) : Unit = this.sideEffectsStream.onNext(sideEffect)
  }
}
