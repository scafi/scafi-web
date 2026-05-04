package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.model.MatrixLed.MatrixMap
import it.unibo.scafi.js.model.Vertex
import org.scalatest.funspec.AnyFunSpec
import org.scalatest.matchers.should.Matchers

import scala.scalajs.js

class StandaloneGraphSnapshotTest extends AnyFunSpec with Matchers {
  describe("standalone graph snapshot") {
    it("normalizes nodes, labels and dangling edges into the shared graph model") {
      val matrix = js.Dynamic.literal(
        dimension = 2,
        pixels = js.Array[js.Any](
          js.Array[js.Any](js.Array[js.Any](0, 0), "#ffffff"),
          js.Array[js.Any](js.Array[js.Any](1, 1), "#000000")
        )
      )
      val state = js.Dynamic.literal(
        nodes = js.Array[js.Any](
          js.Dynamic.literal(
            id = "1",
            x = 0.0,
            y = 0.0,
            labels = js.Dynamic.literal(
              "export" -> "hello",
              "source" -> true,
              "matrix" -> matrix
            )
          ),
          js.Dynamic.literal(
            id = "2",
            x = 10.0,
            y = 20.0,
            labels = js.Dynamic.literal("export" -> 3.14)
          )
        ),
        edges = js.Array[js.Any](
          js.Array[js.Any]("1", "2"),
          js.Array[js.Any]("1", "99")
        )
      )

      val result = StandaloneGraphSnapshot.toGraph(state).get

      result.graph.nodes.map(_.id) shouldBe Set("1", "2")
      result.graph.vertices shouldBe Set(Vertex("1", "2"))
      result.graph("1").labels("source") shouldBe true
      result.graph("1").labels("export") shouldBe "hello"
      result.graph("1").labels("matrix") shouldBe MatrixMap(2, Map((0, 0) -> "#ffffff", (1, 1) -> "#000000"))
      result.warnings.exists(_.contains("Dropping standalone edge 1 -> 99")) shouldBe true
    }
  }
}
