package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.utils.JSNumber

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal

/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Math.html]] */
@js.native
@JSGlobal("Phaser.Math")
object MathNamespace extends js.Object {

  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Math.Vector2.html]] */
  @js.native
  class Vector2(val x: JSNumber = js.native, val y: JSNumber = js.native) extends js.Object
}
