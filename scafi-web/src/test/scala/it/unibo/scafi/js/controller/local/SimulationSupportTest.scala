package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.Utils
import it.unibo.scafi.js.controller.local.SimulationSideEffect._
import it.unibo.scafi.js.controller.local.SimulationSupportTest.SimulationSupportWrapper
import it.unibo.scafi.js.dsl.WebIncarnation
import it.unibo.scafi.js.model.Vertex
import it.unibo.scafi.space.Point3D
import org.scalatest.funspec.AsyncFunSpec
import org.scalatest.matchers.should.Matchers
import org.scalatest.{BeforeAndAfterEach, PrivateMethodTester}

import scala.util.{Failure, Success}

class SimulationSupportTest extends AsyncFunSpec with Matchers with BeforeAndAfterEach with PrivateMethodTester
{
  //a non global context bring to a problems
  override implicit val executionContext = scala.concurrent.ExecutionContext.Implicits.global
  private val monixScheduler = Utils.timeoutBasedScheduler

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
      val newGraph = support.graphStream.firstL.runToFuture(monixScheduler)
      support.evolve(newConfiguration).transform {
        case Success(any) => Success(succeed)
        case Failure(exception) => Success(fail(exception))
      }
      newGraph.map( graph => {
        graph.nodes.size shouldBe (range * range)
        assert(graph.vertices.contains(Vertex("1", "2")))
        val aNode = graph.nodes.head
        aNode.labels("source") shouldBe false
        aNode.labels("obstacle") shouldBe false
        val (nodeA, nodeB) = (graph("1"), graph("2"))
        nodeA.position.distance(nodeB.position) shouldBe range
        succeed
      })
    }

    it("should evolve with random config") {
      val max = 1000
      val nodes = 1000
      val radius = 40
      val newConfiguration = SupportConfiguration(
        RandomNetwork(0, max, nodes),
        SpatialRadius(radius),
        DeviceConfiguration.standard,
        SimulationSeeds()
      )
      val newGraph = support.graphStream.firstL.runToFuture(monixScheduler)
      support.evolve(newConfiguration).transform {
        case Success(any) => Success(succeed)
        case Failure(exception) => Success(fail(exception))
      }
      newGraph.map( graph => {
        graph.nodes.size shouldBe (nodes)
      })
    }

    it("should support move side effect") {
      val newPositionX = 100
      val newPositionY = 100
      val node = "1"
      val sideEffect = PositionChanged(Map(node -> Point3D(newPositionX, newPositionY, 0)))
      val newGraph = support.graphStream.firstL.runToFuture(monixScheduler)
      support.publish(sideEffect)
      newGraph.map { graph => graph(node).position shouldBe Point3D(newPositionX, newPositionY, 0)}
    }

    it("should support sensor update side effect") {
      val newPositionX = 100
      val newPositionY = 100
      val node = "1"
      val sensor = "obstacle"
      val sideEffect = SensorChanged(Map(node -> Map(sensor -> true)))
      val newGraph = support.graphStream.firstL.runToFuture(monixScheduler)
      support.publish(sideEffect)
      newGraph.map { graph => graph(node).labels(sensor) shouldBe true }
    }

    it("should support export produced side effect") {
      val node = "1"
      val exportName = "export"
      val export : WebIncarnation.EXPORT = new WebIncarnation.ExportImpl()
      val sideEffect = ExportProduced(Seq(node -> export))
      val newGraph = support.graphStream.firstL.runToFuture(monixScheduler)
      support.publish(sideEffect)
      newGraph.map { graph => graph(node).labels(exportName) shouldBe export }
    }

    it("should support new configuration side effect") {
      val newGraph = support.graphStream.firstL.runToFuture(monixScheduler)
      support.publish(NewConfiguration)
      newGraph.map { graph => graph.nodes.size shouldBe cols * cols }
    }

    it("should support invalidated side effect") {
      val newGraph = support.graphStream.firstL.runToFuture(monixScheduler)
      support.publish(Invalidated)
      newGraph.map { graph => graph.nodes.size shouldBe cols * cols }
    }
  }
}

object SimulationSupportTest {
  class SimulationSupportWrapper extends SimulationSupport(standardConfig) {
    def publish(sideEffect : SimulationSideEffect) : Unit = this.sideEffectsStream.onNext(sideEffect)
  }
}