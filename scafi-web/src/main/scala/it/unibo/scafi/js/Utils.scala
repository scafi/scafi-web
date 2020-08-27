package it.unibo.scafi.js

import monix.execution.Scheduler

import scala.concurrent.ExecutionContext
import scala.scalajs.js
import scala.scalajs.js.timers.SetIntervalHandle

object Utils {
  def immediate(fun : => Unit) : Unit = js.timers.setTimeout(0){fun}
  def continuously(fun : => Unit) : SetIntervalHandle = js.timers.setInterval(0){fun}
  def schedule(delta : Int)(fun : => Unit) : SetIntervalHandle = js.timers.setInterval(delta){fun}
  def cancel(handler : SetIntervalHandle) = js.timers.clearInterval(handler)
  val timeoutBasedContext : ExecutionContext = new ExecutionContext {
    override def execute(runnable: Runnable): Unit = js.timers.setTimeout(0)(runnable.run())

    override def reportFailure(cause: Throwable): Unit = ExecutionContext.global.reportFailure(cause)
  }

  val timeoutBasedScheduler = Scheduler(timeoutBasedContext)
}
