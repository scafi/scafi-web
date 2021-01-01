package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.local.SupportTesterLike.SimulationSupportWrapper
import it.unibo.scafi.js.dsl.semantics._
import it.unibo.scafi.js.dsl.{BasicWebIncarnation, ScafiInterpreterJs, WebIncarnation}
import it.unibo.scafi.js.utils.Execution
import org.scalatest.BeforeAndAfterEach
import org.scalatest.funspec.AsyncFunSpec
import org.scalatest.matchers.should.Matchers

import scala.scalajs.js.annotation.JSExportTopLevel

class SupportTesterLike extends AsyncFunSpec with Matchers with BeforeAndAfterEach {
  protected var localPlatform : SimulationSupportWrapper = _
  override implicit val executionContext = scala.concurrent.ExecutionContext.Implicits.global

  protected val monixScheduler = Execution.timeoutBasedScheduler
  override def beforeEach(): Unit = {
    localPlatform = new SimulationSupportWrapper()(SupportTesterLike.TestLang)
  }
}

object SupportTesterLike {
  implicit val incarnation : BasicWebIncarnation = WebIncarnation
  @JSExportTopLevel("TestLang")
  object TestLang extends ScafiInterpreterJs("TestLang") with BlockGJs
    with LanguageJs with BlockTJs with StandardSensorJs with BuiltinsJs// interpreter choosen

  class SimulationSupportWrapper(implicit val interpreterJs: ScafiInterpreterJs[BasicWebIncarnation]) extends SimulationSupport(standardConfig)
    with SimulationCommandInterpreter
    with SimulationExecutionPlatform {
    def publish(sideEffect : SimulationSideEffect) : Unit = this.sideEffectsStream.onNext(sideEffect)
    def exportProduced(node : WebIncarnation.ID, e : WebIncarnation.EXPORT) : ExportProduced = {
      val innerExport = e.asInstanceOf[incarnation.EXPORT] //solv
      ExportProduced(Seq(node -> innerExport))
    }
  }
}
