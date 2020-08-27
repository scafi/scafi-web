package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.WebIncarnation._
import it.unibo.scafi.js.controller.{AggregateSystemSupport, ExecutionPlatform}
import it.unibo.scafi.js.controller.local.SimulationExecution.TickBased
import it.unibo.scafi.js.controller.local.SimulationSideEffect.ExportProduced
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.dsl.WebDsl

import scala.concurrent.Future
import scala.scalajs.js
import scala.util.{Failure, Success, Try}

trait SimulationExecutionPlatform extends ExecutionPlatform[SpaceAwareSimulator, SimulationSideEffect, SimulationExecution]{
  self : AggregateSystemSupport[SpaceAwareSimulator, _, SimulationSideEffect] =>
  import SimulationExecutionPlatform._
  override def loadScript(script: Script): Future[SimulationExecution] = script.lang match {
    case "javascript" => Try { rawToFunction(script.code) } match {
      case Failure(exception) => Future.failed(exception)
      case Success(value) => Future.successful(sideEffectExecution(value))
    }
    case _ => Future.failed(new IllegalArgumentException("lang not supported"))
  }
  private def sideEffectExecution(program : js.Function0[Any]) : TickBased = {
    val execution : (Int => Unit) = batchSize => {
      val exports = (0 until batchSize).map(_ => backend.exec(WebDsl.adaptForScafi(program)))
      sideEffectsStream.onNext(ExportProduced(exports))
    }
    backend.clearExports() //clear export for the new script
    TickBased(exec = execution)
  }

}
object SimulationExecutionPlatform {
  private def rawToFunction(code : String) : js.Function0[Any] = {
    val wrappedCode = s"""() => {
                         | with(scafiDsl) {
                         |   var result = ${code};
                         |   return result
                         | }
                         |}""".stripMargin
    js.eval(wrappedCode).asInstanceOf[js.Function0[Any]]
  }
}
