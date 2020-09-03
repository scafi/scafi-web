package it.unibo.scafi.js.controller.local

import java.util.NoSuchElementException

import it.unibo.scafi.js.controller.local.SimulationSupportTest.SimulationSupportWrapper
import monix.eval.Task
import org.scalatest.{BeforeAndAfterEach, PrivateMethodTester}
import org.scalatest.funspec.AsyncFunSpec
import org.scalatest.matchers.should.Matchers

import scala.util.{Failure, Success}

class SimulationSupportTest extends AsyncFunSpec with Matchers with BeforeAndAfterEach with PrivateMethodTester
{
  import SimulationExecutionTest._
  import org.scalatest.concurrent.ScalaFutures._
  var support : SimulationSupportWrapper = _
  override def beforeEach(): Unit = support = new SimulationSupportWrapper()

  describe("simulation support") {
    it("should evolve with new configuration") {
      val range = 5
      val newConfiguration = SupportConfiguration(
        GridLikeNetwork(range, range, range, range, 0),
        SpatialRadius(range),
        DeviceConfiguration.standard,
        SimulationSeeds()
      )
      support.graphStream.doOnNext(graph => Task())
      support.evolve(newConfiguration).transform {
        case Success(any) => Success(succeed)
        case Failure(exception) => Success(fail(exception))
      }
    }
  }
}

object SimulationSupportTest {
  class SimulationSupportWrapper extends SimulationSupport(standardConfig) {
    def publish(sideEffect : SimulationSideEffect) : Unit = this.sideEffectsStream.onNext(sideEffect)
  }
}