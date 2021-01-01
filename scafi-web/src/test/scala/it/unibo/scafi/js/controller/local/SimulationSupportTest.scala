package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.local.SupportTesterLike.incarnation
import it.unibo.scafi.js.dsl.WebIncarnation
import it.unibo.scafi.js.model.Vertex
import it.unibo.scafi.space.Point3D

import scala.util.{Failure, Success}

class SimulationSupportTest extends SupportTesterLike {
  describe("simulation support") {
    it("should evolve with new configuration") {
      val range = 5
      val newConfiguration = SupportConfiguration(
        GridLikeNetwork(range, range, range, range, 0),
        SpatialRadius(range),
        DeviceConfiguration.standard,
        SimulationSeeds()
      )
      val newGraph = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      localPlatform.evolve(newConfiguration).transform {
        case Success(any) => Success(succeed)
        case Failure(exception) => Success(fail(exception))
      }
      newGraph.map(graph => {
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
      val newGraph = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      localPlatform.evolve(newConfiguration).transform {
        case Success(any) => Success(succeed)
        case Failure(exception) => Success(fail(exception))
      }
      newGraph.map(graph => {
        graph.nodes.size shouldBe (nodes)
      })
    }

    it("should support move side effect") {
      val newPositionX = 100
      val newPositionY = 100
      val node = "1"
      val sideEffect = localPlatform.PositionChanged(Map(node -> Point3D(newPositionX, newPositionY, 0)))
      val newGraph = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      localPlatform.publish(sideEffect)
      newGraph.map { graph => graph(node).position shouldBe Point3D(newPositionX, newPositionY, 0) }
    }

    it("should support sensor update side effect") {
      val newPositionX = 100
      val newPositionY = 100
      val node = "1"
      val sensor = "obstacle"
      val sideEffect = localPlatform.SensorChanged(Map(node -> Map(sensor -> true)))
      val newGraph = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      localPlatform.publish(sideEffect)
      newGraph.map { graph => graph(node).labels(sensor) shouldBe true }
    }

    it("should support export produced side effect") {
      val node = "1"
      val exportName = "export"
      val export : WebIncarnation.EXPORT = new WebIncarnation.ExportImpl()
      val sideEffect = localPlatform.exportProduced(node, export) //TODO FIX!
      val newGraph = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      localPlatform.publish(sideEffect)
      newGraph.map { graph => graph(node).labels(exportName) shouldBe export }
    }

    it("should support new configuration side effect") {
      val newGraph = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      localPlatform.publish(localPlatform.NewConfiguration)
      newGraph.map { graph => graph.nodes.size shouldBe cols * cols }
    }

    it("should support invalidated side effect") {
      val newGraph = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      localPlatform.publish(localPlatform.Invalidated)
      newGraph.map { graph => graph.nodes.size shouldBe cols * cols }
    }
  }
}