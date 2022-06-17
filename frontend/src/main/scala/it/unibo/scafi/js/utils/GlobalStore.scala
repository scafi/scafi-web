package it.unibo.scafi.js.utils

import it.unibo.scafi.js.view.dynamic.{EventBus, PageBus}
import monix.execution.CancelableFuture
import org.scalajs.dom.window

import scala.scalajs.js
import scala.util.{Failure, Success, Try}

object GlobalStore {
  /** Express any kind of Key accepted by the global store. It piggyback the data type stored inside the store. To
    * create a key, use anonymous class: val key = new GlobalStore.Key { type Data = Something val keyValue =
    * "something" }
    */
  trait Key {
    type Data
    val value: String
  }
  private val bus = new EventBus()
  private case class GlobalData[A](key: String, value: A)
  private val store = window.asInstanceOf[js.Dynamic] // a non safe way, think other possibilities
  def put(key: Key)(value: key.Data): Unit = {
    store.updateDynamic(key.value)(value.asInstanceOf[js.Any])
    bus.publish(GlobalData(key.value, value))
  }
  def listen(key: Key)(on: key.Data => Unit): CancelableFuture[Unit] = bus.listen { case GlobalData(key.value, value) =>
    on(value.asInstanceOf[key.Data])
  }
  def get(key: Key): Try[key.Data] = {
    Try(store.selectDynamic(key.value).asInstanceOf[key.Data]).flatMap {
      case obj if js.isUndefined(obj) => Failure(new IllegalArgumentException("object not in global scope"))
      case other => Success(other)
    }
  }
  def getOrElse(name: Key)(orElse: name.Data): name.Data =
    get(name).getOrElse(orElse)
  def getOrElseUpdate(name: Key)(orElse: name.Data): name.Data = {
    get(name) match {
      case Success(value) => value
      case Failure(_) =>
        put(name)(orElse)
        orElse
    }
  }
}
