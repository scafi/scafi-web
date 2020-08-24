package it.unibo.scafi.js.facade.phaser

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport

@js.native
@JSImport("phaser", JSImport.Namespace)
object Animations extends js.Object {
  @js.native
  class AnimationManager(var game : Phaser.Game) extends js.Object { /* todo */ }
}
