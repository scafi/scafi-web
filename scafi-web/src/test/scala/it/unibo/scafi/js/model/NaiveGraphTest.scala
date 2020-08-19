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
      graph.neighbours("2") shouldBe graph.neighbours(node("2"))
    }
  }
}

object NaiveGraphTest {
  def node(id : String) : Node = Node(id, Point3D.Zero)
}
