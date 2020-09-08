package it.unibo.scafi.js.utils

import scala.scalajs.js
import scala.scalajs.js.annotation.JSExportTopLevel

/**
  * a top level object used to inspect the value of javascript object at runtime
  */
object Debug {
  @JSExportTopLevel("Debug")
  val objects = js.Dictionary[Any]()

  def apply(name : String, value :  Any) : Unit = objects.put(name, value)
}
