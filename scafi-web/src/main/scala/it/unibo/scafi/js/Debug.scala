package it.unibo.scafi.js

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSExportAll, JSExportTopLevel}
import scala.scalajs.js.|

/**
  * a top level object used to inspect the value of javascript object at runtime
  */
object Debug {
  @JSExportTopLevel("Debug")
  val objects = js.Dictionary[js.Object | Any]()

  def apply(name : String, value : js.Object | Any) : Unit = objects.put(name, value)
}
