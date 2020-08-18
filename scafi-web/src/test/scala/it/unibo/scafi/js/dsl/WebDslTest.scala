package it.unibo.scafi.js.dsl

import it.unibo.scafi.js.WebIncarnation._
import it.unibo.scafi.js.WebIncarnationUtils._
import it.unibo.scafi.js.dsl.WebDslTest._
import org.scalatest.funspec.AnyFunSpec
import org.scalatest.matchers.should.Matchers

import scala.scalajs.js

class WebDslTest extends AnyFunSpec with Matchers {
  describe("web dsl") {
    it("has same behaviour of scala-based lang") {
      val net : NETWORK = network()
      val baseValue = 10
      val program : AggregateProgram = new AggregateProgram {
        override def main(): Any = baseValue
      }
      val jsProgram = rawToFunction(s"$baseValue")
      val (_, scalaExport) = net.exec(program)
      val (_, jsExport) = net.exec(WebDsl.toScafiRuntime(jsProgram))
      jsExport.root[Int]() shouldBe scalaExport.root[Int]()
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
