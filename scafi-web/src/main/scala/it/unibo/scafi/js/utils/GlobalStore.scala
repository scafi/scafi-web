package it.unibo.scafi.js.utils

import org.scalajs.dom.window

import scala.scalajs.js
import scala.util.{Failure, Success, Try}

object GlobalStore {
  private val store = window.asInstanceOf[js.Dynamic] //a non safe way, think other possibilities
  def put(name : String, value : Any) : Unit = store.updateDynamic(name)(value.asInstanceOf[js.Any])
  def get[A](name : String) : Try[A] = {
    Try { store.selectDynamic(name).asInstanceOf[A]}.flatMap {
      case obj if js.isUndefined(obj) => Failure(new IllegalArgumentException("object not in global scope"))
      case other => Success(other)
    }
  }
}
