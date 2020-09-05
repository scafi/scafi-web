package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.utils.JSNumber

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal

@js.native
@JSGlobal("Phaser.Geom")
object GeomNamespace extends js.Object {
  @js.native
  class Rectangle() extends js.Object {
    var x : JSNumber = js.native
    var y : JSNumber = js.native
    var width : JSNumber = js.native
    var height : JSNumber = js.native
  }
  @js.native
  class Point(val x : JSNumber = js.native, val y : JSNumber = js.native) extends js.Object

  PartialFunction
}
