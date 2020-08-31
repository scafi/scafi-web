package it.unibo.scafi.js

import it.unibo.scafi.space.Point3D
import monix.execution.Scheduler

import scala.concurrent.ExecutionContext
import scala.scalajs.js
import scala.scalajs.js.annotation.{JSExportAll, JSExportTopLevel}
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

  @JSExportTopLevel("Point3D")
  @JSExportAll
  case class JSPoint3D(override val x : Double, override val y : Double, override val z : Double) extends Point3D(x, y, z)

  @JSExportTopLevel("Point2D")
  @JSExportAll
  case class JSPoint2D(override val x : Double, override val y : Double, override val z : Double) extends Point3D(x, y, z)

  def stringify[E](element : E) : String = {
    val any : js.Any = element.asInstanceOf[js.Any]
    js.Dynamic.global.JSON.stringify(any).toString
  }
}
