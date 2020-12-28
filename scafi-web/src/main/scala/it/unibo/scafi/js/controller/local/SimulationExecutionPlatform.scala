package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.ExecutionPlatform
import it.unibo.scafi.js.controller.local.SimulationExecution.TickBased
import it.unibo.scafi.js.controller.local.SimulationSideEffect.SideEffects
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.controller.scripting.Script.{Javascript, ScaFi}
import it.unibo.scafi.js.dsl.JF1
import it.unibo.scafi.simulation.SpatialSimulation

import scala.concurrent.Future
import scala.scalajs.js
import scala.util.Try

/**
  * the execution platform of a local simulation in web browser.
  * Currently it supports only javascript execution.
  */
trait SimulationExecutionPlatform extends ExecutionPlatform[SpatialSimulation#SpaceAwareSimulator, SimulationSideEffect, SimulationExecution]{
  self : SimulationSupport with SideEffects =>
  import SimulationExecutionPlatform._
  import incarnation._
  override def loadScript(script: Script): Future[SimulationExecution] = script match {
    case Javascript(code) => Future.fromTry {
      Try { rawToFunction(code) }
        .map(interpreter.adaptForScafi)
        .map(_.asInstanceOf[JF1[CONTEXT, EXPORT]]) //TODO NOT SAFE! FIND ANOTHER WAY
        .map(sideEffectExecution)
    }
    case aggregateClass : ScaFi[AggregateProgram] => Future.fromTry {
      Try { sideEffectExecution(aggregateClass.program) }
    }
    case _ => Future.failed(new IllegalArgumentException("lang not supported"))
  }
  private def sideEffectExecution(program : js.Function1[CONTEXT, EXPORT]) : TickBased = {
    val execution : (Int => Unit) = batchSize => {
      //TODO FIX (it'isnt easy...)
      val exports = (0 until batchSize).map(_ => backend.exec(program))
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
