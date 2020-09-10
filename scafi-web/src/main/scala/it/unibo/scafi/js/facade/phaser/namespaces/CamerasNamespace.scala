package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.facade.phaser.namespaces.cameras.Scene2DNamespace

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal
/**
 * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Cameras.html]]
 */
@js.native
@JSGlobal("Phaser.Cameras")
object CamerasNamespace extends js.Object {
  val Scene2D : Scene2DNamespace.type = js.native
}
