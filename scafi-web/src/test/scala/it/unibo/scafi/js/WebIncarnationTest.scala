package it.unibo.scafi.js

import it.unibo.scafi.js.WebIncarnation._
import org.scalatest.funspec.AnyFunSpec
import org.scalatest.matchers.should.Matchers
//TODO add test for nbrvar, foldhoodPlus,...
class WebIncarnationTest extends AnyFunSpec with Matchers with NetworkSupport {
  val platform = WebIncarnation

  describe("web incarnation") {
    it("should exec an aggregate program") {
      val fieldValue = 1
      val program = new WebIncarnation.AggregateProgram {
        override def main(): Any = fieldValue
      }
      val (id, result) = webEngine.exec(program)
      result.root[Int]() shouldBe fieldValue
    }

    it("should support rep construct") {
      val initialValue = 0
      val repProgram = new WebIncarnation.AggregateProgram {
        override def main(): Any = rep(initialValue)(_ + 1)
      }
      val (id, result) = webEngine.exec(repProgram)
      result.root[Int]() shouldBe (initialValue + 1)
      val (_, updatedResult) = Stream.continually(webEngine.exec(repProgram))
        .find { case (newId,_) => newId == id}
        .get
      updatedResult.root[Int]() shouldBe (result.root[Int]() + 1)
    }
    it("should support nbr and foldhood construct") {
      val middleElement = "5"
      val neighbours = 5 //at the end, the middle node tend to have four neighbours plus itself
      val program = new WebIncarnation.AggregateProgram {
        override def main(): Any = foldhood(0)(_ + _)(nbr(1))
      }
      val neighboursResult = Stream.continually(webEngine.exec(program))
        .filter { case (id, _) => id == middleElement }
        .exists { case (_, value) => value.root[Int]() == neighbours}
      assert(neighboursResult)
    }
    it("should support mid construct") {
      val nodes = webEngine.ids
      val program = new WebIncarnation.AggregateProgram {
        override def main(): Any = mid()
      }
      val mids = Stream.continually(webEngine.exec(program))
        .map { case (_, export) => export.root[ID]() }
        .take(100) //exec program multiple times to be sure that in each node it is computed
        .toSet
      nodes shouldBe mids
    }
    it("should support sense construct") {
      val sensorName = "source"
      webEngine.addSensor(sensorName, false)
      webEngine.chgSensorValue(sensorName, Set("5"), true)
      val program = new WebIncarnation.AggregateProgram {
        override def main(): Any = sense[Boolean](sensorName)
      }
      val sensorValues = Stream.continually(webEngine.exec(program))
        .map { case (id, export) => id -> export.root[Boolean]()}
        .take(100) //exec program multiple times to be sure that in each node it is computed
        .toSet

      assert(sensorValues.contains("1" -> false))
      assert(sensorValues.contains("5" -> true))
    }
    it("should support mux construct") {
      val sensorName = "source"
      webEngine.addSensor(sensorName, false)
      webEngine.chgSensorValue(sensorName, Set("5"), true)
      val falseValue = 0
      val trueValue = 1
      val program = new WebIncarnation.AggregateProgram {
        override def main(): Any = mux(sense[Boolean](sensorName))(trueValue)(falseValue)
      }
      val sensorValues = Stream.continually(webEngine.exec(program))
        .map { case (id, export) => id -> export.root[Int]()}
        .take(100) //exec program multiple times to be sure that in each node it is computed
        .toSet

      assert(sensorValues.contains("1" -> falseValue))
      assert(sensorValues.contains("5" -> trueValue))
    }
  }
}
