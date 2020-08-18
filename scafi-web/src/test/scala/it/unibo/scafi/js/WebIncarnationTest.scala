package it.unibo.scafi.js

import it.unibo.scafi.config.GridSettings
import org.scalatest.funspec.AnyFunSpec
import org.scalatest.matchers.should.Matchers
class WebIncarnationTest extends AnyFunSpec with Matchers {
  val platform = WebIncarnation
  /**
   * a network composed by nine nodes arranged in a grid
   * 1 - 2 - 3
   * |   |   |
   * 4 - 5 - 6
   * |   |   |
   * 7 - 8 - 9
   */
  def network(): WebIncarnation.NETWORK = {
    val radius = 3
    val elements = 3
    val settings = GridSettings(
      nrows = elements,
      ncols = elements,
      stepx = radius,
      stepy = radius
    )
    platform.simulatorFactory.gridLike(settings, radius)
  }
  describe("web incarnation") {
    it("should exec an aggregate program") {
      val net = network()
      val fieldValue = 1
      val program = new WebIncarnation.AggregateProgram {
        override def main(): Any = fieldValue
      }
      val (id, result) = net.exec(program)
      result.root[Int]() shouldBe fieldValue
    }

    it("should support rep construct") {
      val net = network()
      val initialValue = 0
      val repProgram = new WebIncarnation.AggregateProgram {
        override def main(): Any = rep(initialValue)(_ + 1)
      }
      val (id, result) = net.exec(repProgram)
      result.root[Int]() shouldBe (initialValue + 1)
      val (_, updatedResult) = Stream.continually(net.exec(repProgram))
          .find { case (newId,_) => newId == id}
          .get
      updatedResult.root[Int]() shouldBe (result.root[Int]() + 1)
    }

    it("should support nbr and foldhood construct") {
      val net = network()
      val initialValue = 0
      val middleNode = 5
      val neighbours = 4
      val program = new WebIncarnation.AggregateProgram {
        override def main(): Any = foldhoodPlus(0)(_ + _)(nbr(1))
      }
      val neighboursResult = Stream.continually(net.exec(program))
        .filter { case (id,_) => id == middleNode }
        .exists { case (_, value) => value == neighbours}
      assert(neighboursResult)
    }
  }
}
