package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.facade.phaser.Phaser

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal

/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Animations.html]] */
@js.native
@JSGlobal("Phaser.Animations")
object AnimationsNamespace extends js.Object {
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Animations.AnimationManager.html]] */
  @js.native
  class AnimationManager(var game: Phaser.Game) extends js.Object { /* todo */ }
}
