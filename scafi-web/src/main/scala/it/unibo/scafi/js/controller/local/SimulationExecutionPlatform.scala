package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.ExecutionPlatform
import it.unibo.scafi.js.controller.local.SimulationExecution.TickBased
import it.unibo.scafi.js.controller.local.SimulationSideEffect.SideEffects
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.dsl.{BasicWebIncarnation, ScafiInterpreterJs}
import it.unibo.scafi.simulation.SpatialSimulation

import scala.concurrent.Future
import scala.scalajs.js
import scala.util.{Failure, Success, Try}

/**
  * the execution platform of a local simulation in web browser.
  * Currently it supports only javascript execution.
  */
trait SimulationExecutionPlatform extends ExecutionPlatform[SpatialSimulation#SpaceAwareSimulator, SimulationSideEffect, SimulationExecution]{
  self : SimulationSupport with SideEffects =>
  import SimulationExecutionPlatform._
  import incarnation._
  override def loadScript(script: Script): Future[SimulationExecution] = script.lang match {
    case "javascript" => Try { rawToFunction(script.code) } match {
      case Failure(exception) => Future.failed(exception)
      case Success(value) => Future.successful(sideEffectExecution(value))
    }
    case _ => Future.failed(new IllegalArgumentException("lang not supported"))
  }

  private def sideEffectExecution(program : js.Function0[Any]) : TickBased = {
    val execution : (Int => Unit) = batchSize => {
      //TODO FIX (it'isnt easy...)
      val exports = (0 until batchSize).map(_ => backend.exec(interpreter.adaptForScafi(program).asInstanceOf[js.Function1[CONTEXT,EXPORT]]))
      sideEffectsStream.onNext(ExportProduced(exports))
    }
    backend.clearExports() //clear export for the new script
    sideEffectsStream.onNext(Invalidated) //invalid old graph value
    TickBased(exec = execution)
  }
}

object SimulationExecutionPlatform {
  private def rawToFunction(code : String) : js.Function0[Any] = {
    val wrappedCode = s"""() => {
                         | with(Lang) {
                         |   ${code};
                         | }
                         |}""".stripMargin
    js.eval(wrappedCode).asInstanceOf[js.Function0[Any]]
  }
}
