package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.utils.JSNumber

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal

/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Scale.html]] */
@js.native
@JSGlobal("Phaser.Scale")
object ScaleNamespace extends js.Object {
  /* NAMESPACE */
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Scale.ScaleModes.html]] */
  @js.native
  object ScaleModes extends js.Object {
    val FIT: ScaleModeValue = js.native
    val HEIGHT_CONTROLS_WIDTH: ScaleModeValue = js.native
    val NONE: ScaleModeValue = js.native
    val RESIZE: ScaleModeValue = js.native
    val WIDTH_CONTROLS_HEIGHT: ScaleModeValue = js.native
  }

  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Scale.Zoom.html]] */
  @js.native
  object Zoom extends js.Object {
    val MAX_ZOOM: ZoomValue = js.native
    val NO_ZOOM: ZoomValue = js.native
    val ZOOM_2X: ZoomValue = js.native
    val ZOOM_4X: ZoomValue = js.native
  }

  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Scale.Center.html]] */
  @js.native
  object Center extends js.Object {
    val CENTER_BOTH: CenterValue = js.native
    val CENTER_HORIZONTALLY: CenterValue = js.native
    val CENTER_VERTICALLY: CenterValue = js.native
    val NO_CENTER: CenterValue = js.native
  }
  /* CLASSES  */
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Scale.ScaleManager.html]] */
  @js.native
  trait ScaleManager extends js.Object {
    var zoom: JSNumber
  }
  /*Types Helper*/
  @js.native
  trait ScaleModeValue extends js.Any
  @js.native
  trait ZoomValue extends js.Any
  @js.native
  trait CenterValue extends js.Any
}
