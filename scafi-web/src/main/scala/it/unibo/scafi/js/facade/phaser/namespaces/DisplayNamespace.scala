package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.facade.phaser.namespaces.display.ColorNamespace

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal

/**
 * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Display.html]]
 */
@js.native
@JSGlobal("Phaser.Display")
object DisplayNamespace extends js.Object {
  /* NAMESPACES */
  val Color : ColorNamespace.type = js.native
}
