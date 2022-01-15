package it.unibo.scafi.js.facade.phaser.namespaces.cameras

import it.unibo.scafi.js.utils.JSNumber

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal
import scala.scalajs.js.|
/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Cameras.Scene2D.html]] */
@js.native
@JSGlobal("Phaser.Scene2D")
object Scene2DNamespace extends js.Object {
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Cameras.Scene2D.Camera.html]] */
  @js.native
  trait Camera extends js.Object {
    var zoom: JSNumber = js.native
    var x: JSNumber = js.native
    var y: JSNumber = js.native
    var scrollX: JSNumber = js.native
    var scrollY: JSNumber = js.native
    def zoomTo(
        zoom: JSNumber,
        duration: Int = js.native,
        ease: String | js.Function = js.native,
        force: Boolean = js.native,
        callback: js.Any = js.native,
        context: js.Any = js.native
    )
    def setBounds(x: Int, y: Int, width: Int, height: Int): Camera
    def setPosition(x: Int = js.native, y: Int = js.native): Camera
  }
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Cameras.Scene2D.CameraManager.html]] */
  @js.native
  trait CameraManager extends js.Object {
    /* members */
    def main: Camera
    /* methods */
    def resize(width: Double, height: Double)
  }
}
