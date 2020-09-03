package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.utils.JSNumber

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal

@js.native
@JSGlobal("Phaser.Math")
object MathNamespace extends js.Object {
  @js.native
  class Vector2(val x : JSNumber = js.native, val y : JSNumber = js.native) extends js.Object
}
