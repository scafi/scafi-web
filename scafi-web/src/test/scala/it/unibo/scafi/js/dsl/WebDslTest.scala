package it.unibo.scafi.js.dsl

import it.unibo.scafi.js.NetworkSupport
import it.unibo.scafi.js.WebIncarnation._
import it.unibo.scafi.js.dsl.WebDslTest._
import org.scalatest.funspec.AnyFunSpec
import org.scalatest.matchers.should.Matchers

import scala.scalajs.js

//TODO add test for nbrvar, foldhoodPlus,...
class WebDslTest extends AnyFunSpec with Matchers with NetworkSupport {
  describe("web dsl") {
    it("has same behaviour of scala-based lang") {
      val baseValue = 10
      val program : AggregateProgram = new AggregateProgram {
        override def main(): Any = baseValue
      }
      val jsProgram = rawToFunction(s"$baseValue")
      val (_, scalaExport) = webEngine.exec(program)
      val (_, jsExport) = webEngine.exec(WebDsl.adaptForScafi(jsProgram))
      jsExport.root[Int]() shouldBe scalaExport.root[Int]()
    }
    it("has rep construct") {
      val program = WebDsl.adaptForScafi(rawToFunction("rep(() => 0, x => x + 1)"))
      val executions = 100
      val node = "1"
      val executionOnOne = Stream.fill(executions)(webEngine.exec(program))
        .filter { case (id, _) => id == node}
        .map { case (_, export) => export.root[Int]()}
        .toList
      executionOnOne shouldBe (1 to executionOnOne.size).toList
    }
    it("has mid construct") {
      val program = WebDsl.adaptForScafi(rawToFunction("mid()"))
      val (id, export) = webEngine.exec(program)
      id shouldBe export.root[ID]()
    }
    it("has nbr and foldhood construct") {
      val program = rawToFunction("foldhood(() => 0, (x, y) => x + y, () => nbr(() => 1))")
      val iterations = 100
      val foldResults = Stream.fill(iterations){ webEngine.exec(WebDsl.adaptForScafi(program)) }
        .map { case (id, export) => id -> export.root[Int]()}
        .toSet
      assert(foldResults.contains("1" -> 3))
      assert(foldResults.contains("2" -> 4))
      assert(foldResults.contains("5" -> 5))
    }
    it("has sense construct") {
      val sensor = "source"
      webEngine.addSensor(sensor, false)
      webEngine.chgSensorValue(sensor, Set("5"), true)
      val iterations = 100
      val program = WebDsl.adaptForScafi(rawToFunction(s"""sense("${sensor}")"""))
      val sensors = Stream.fill(iterations){ webEngine.exec(program) }
        .map { case (id, export) => id -> export.root[Boolean]()}
        .toSet
      sensors.contains("1" -> false)
      sensors.contains("5" -> true)
    }

  }
}

object WebDslTest {
  def rawToFunction(code : String) : js.Function0[Any] = {
    val wrappedCode = s"""() => {
                         | with(scafiDsl) {
                         |   var result = ${code};
                         |   return result
                         | }
                         |}""".stripMargin
    js.eval(wrappedCode).asInstanceOf[js.Function0[Any]]
  }
}
