package it.unibo.scafi.js.facade.phaser.namespaces

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSGlobal, JSImport}

/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Renderer.html]] */
@js.native
@JSGlobal("Phaser.Renderer")
object RendererNamespace extends js.Object {
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Renderer.Canvas.html]] */
  @js.native
  object Canvas extends js.Object {
    /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Renderer.Canvas.CanvasRenderer.html]] */
    trait CanvasRender extends js.Object { /* todo */ }
  }
}
