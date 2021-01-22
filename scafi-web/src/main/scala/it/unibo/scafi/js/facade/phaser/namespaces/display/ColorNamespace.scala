package it.unibo.scafi.js.facade.phaser.namespaces.display

import it.unibo.scafi.js.utils.JSNumber

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal

/**
 * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Display.Color.html]]
 */
@js.native
@JSGlobal("Phaser.Display.Color")
object ColorNamespace extends js.Object {
  def HSLToColor(h : JSNumber, s : JSNumber, l : JSNumber) : Color = js.native
  /**
   * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Display.Color.html]]
   */
  @js.native
  trait Color extends js.Object {
    val alpha : JSNumber = js.native
    val r : Int = js.native
    val g : Int = js.native
    val b : Int = js.native
    val color : Int = js.native
    val color32 : Int = js.native
  }
}
