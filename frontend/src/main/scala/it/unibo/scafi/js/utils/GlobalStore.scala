package it.unibo.scafi.js.utils

import it.unibo.scafi.js.view.dynamic.{EventBus, PageBus}
import monix.execution.CancelableFuture
import org.scalajs.dom.window

import scala.scalajs.js
import scala.util.{Failure, Success, Try}

object GlobalStore {
  private val bus = new EventBus()
  private case class GlobalData[A](name: String, value: A)
  private val store = window.asInstanceOf[js.Dynamic] // a non safe way, think other possibilities
  def put(name: String, value: Any): Unit = {
    store.updateDynamic(name)(value.asInstanceOf[js.Any])
    bus.publish(GlobalData(name, value))
  }
  def listen[A](name: String)(on: A => Unit): CancelableFuture[Unit] = bus.listen { case GlobalData(`name`, value: A) =>
    on(value)
  }
  def get[A](name: String): Try[A] = {
    Try(store.selectDynamic(name).asInstanceOf[A]).flatMap {
      case obj if js.isUndefined(obj) => Failure(new IllegalArgumentException("object not in global scope"))
      case other => Success(other)
    }
  }
  def getOrElse[A](name: String, orElse: A): A =
    get[A](name).getOrElse(orElse)
  def getOrElseUpdate[A](name: String, orElse: A): A = {
    get[A](name) match {
      case Success(value) => value
      case Failure(_) =>
        put(name, orElse)
        orElse
    }
  }
}
