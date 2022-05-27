package it.unibo.scafi.js.utils

import monix.execution.Scheduler

import scala.concurrent.ExecutionContext
import scala.scalajs.js
import scala.scalajs.js.timers.{SetIntervalHandle, SetTimeoutHandle}

/** a set of utility to wrap scala.js function to manage javascript interval and timeout. */
object Execution {
  /** try to exec an handler as soon as possible.
    * @param fun
    *   the handler that will execute
    */
  def immediate(fun: => Unit): Unit = js.timers.setTimeout(0)(fun)

  /** exec continually an handler (it use setInterval(0)(fun))
    * @param fun
    *   the handler to execute continually
    */
  def continuously(fun: => Unit): JavascriptHandler = JavascriptIntervalHandler(js.timers.setInterval(0)(fun))

  /** schedule a computation with a certain period
    * @param delta
    *   the period in which the handler will be executed
    * @param fun
    *   the handler to execute at certain period
    */
  def schedule(delta: Int)(fun: => Unit): JavascriptHandler = JavascriptIntervalHandler(js.timers.setInterval(delta) {
    fun
  })

  /** an execution context that used internally js.timers.setTimeout(0) */
  val timeoutBasedContext: ExecutionContext = new ExecutionContext {
    override def execute(runnable: Runnable): Unit = js.timers.setTimeout(0)(runnable.run())

    override def reportFailure(cause: Throwable): Unit = ExecutionContext.global.reportFailure(cause)
  }

  /** a monix scheduler based on timeoutBasedContext */
  val timeoutBasedScheduler = Scheduler(timeoutBasedContext)

  /** a root interface used to wrap the result of setTimeout and setInterval. It allow to cancel a computation. */
  sealed trait JavascriptHandler {
    /** cancel the computation associated to this handler */
    def cancel: Unit
  }

  /** wrap the result of setTimeout */
  case class JavascriptTimeoutHandler(private val handler: SetTimeoutHandle) extends JavascriptHandler {
    override def cancel: Unit = js.timers.clearTimeout(handler)
  }

  /** wrap the result of setInterval */
  case class JavascriptIntervalHandler(private val handler: SetIntervalHandle) extends JavascriptHandler {
    def cancel: Unit = js.timers.clearInterval(handler)
  }
}
