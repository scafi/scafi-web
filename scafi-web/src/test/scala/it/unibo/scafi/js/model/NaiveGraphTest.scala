package it.unibo.scafi.js.model

import it.unibo.scafi.space.Point3D
import org.scalatest.funspec.AnyFunSpec
import org.scalatest.matchers.should.Matchers

class NaiveGraphTest extends AnyFunSpec with Matchers {
  import NaiveGraphTest._

  describe("Naive graph") {
    it("has correct nodes and vertex") {
      val nodes = Set(node("1"), node("2"), node("3"))
      val vertices = Set(Vertex("1", "2"))
      val graph = NaiveGraph(nodes, vertices)
      nodes shouldBe graph.nodes
      vertices shouldBe graph.vertices
    }

    it("has correct neighbours") {
      val nodes = Set(node("1"), node("2"), node("3"))
      val vertices = Set(Vertex("1", "2"), Vertex("1", "3"))
      val graph = NaiveGraph(nodes, vertices)
      val neighboursId = graph.neighbours("1").map(_.id)
      neighboursId shouldBe Set("2", "3")
      //it is directed:
      graph.neighbours("2") shouldBe Set.empty
      graph neighbours("2") shouldBe graph.neighbours(node("2"))
    }
    /*TODO if there are serious performance problems, this check must be cancelled
    it("should throw exception if vertex set contains a node not present in the graph") {
      val nodes = Set(node("1"))
      val vertices = Set(Vertex("1", "2"))
      assertThrows[IllegalArgumentException] {
        NaiveGraph(nodes, vertices)
      }
    }*/
    it("apply works as expected ") {
      standardGraph("1") shouldBe node("1")
    }

    it("apply throws exception if the id isn't present") {
      assertThrows[NoSuchElementException]{standardGraph("bibo")}
    }

    it("get return node if the node is present") {
      standardGraph.get("1") shouldBe Some(node("1"))
    }

    it("get return None if the node isn't present") {
      standardGraph.get("bibo") shouldBe None
    }
  }
  import GraphOps.Implicits._ //graphs operations
  import Graph._ //graphs implicit
  describe("Naive graphs ops") {
    it("don't alter graph") {
      standardGraph.insertNode(node("3"))
      standardGraph contains("3") shouldBe false
    }

    it("insert node return graph with new node") {
      val newGraph = standardGraph.insertNode(node("3"))
      newGraph contains("3") shouldBe true
      newGraph shouldNot be(standardGraph)
    }

    it("insert node update existing node") {
      val label = Map("label" -> 10)
      val newNode = Node("1", Point3D.Zero, label)
      val newGraph = standardGraph.insertNode(newNode)
      newGraph("1").labels shouldBe label
    }

    it("remove node return graph without the node node") {
      val newGraph = standardGraph.removeNode("1")
      newGraph contains("1") shouldBe false
    }

    it("remove node not present return the same graph") {
      val newGraph = standardGraph.removeNode("lemmy")
      newGraph shouldBe standardGraph
    }

    it("link add vertex between two nodes") {
      val newVertex : Vertex = "2" -> "1"
      val newGraph = standardGraph.link(newVertex)
      newGraph.vertices contains newVertex shouldBe true
      newGraph.vertices shouldNot be(standardGraph.vertices)
    }
    /*TODO to performance reason this test can be removed
    it("link a non existing node throws exception") {
      val newVertex : Vertex = "3" -> "1"
      assertThrows[IllegalArgumentException](standardGraph.link(newVertex))
    }*/

    it("unlink a vertex return an updated graph without that link") {
      val vertexToRemove : Vertex = "1" -> "2"
      val newGraph = standardGraph.unlink(vertexToRemove)
      newGraph.vertices contains vertexToRemove shouldBe false
      newGraph.neighbours("1") shouldBe Set()
    }

    it("allow to change enterly a neighbour of a node") {
      val nodes = Set(node("1"), node("2"), node("3"), node("4"))
      val vertex = Set(Vertex("1", "2"))
      val graph = NaiveGraph(nodes, vertex)
      val newGraph = graph.replaceNeighbours("1", Set("1", "3", "4"))
      newGraph.neighbours("1").map(_.id) shouldBe Set("1", "3", "4")
      newGraph.vertices shouldBe Set(Vertex("1", "1"), Vertex("1", "3"), Vertex("1", "4"))
    }
  }
}

object NaiveGraphTest {
  def node(id : String) : Node = Node(id, Point3D.Zero)
  val standardGraph = NaiveGraph(Set(node("1"), node("2")), Set(Vertex("1", "2")))
}
