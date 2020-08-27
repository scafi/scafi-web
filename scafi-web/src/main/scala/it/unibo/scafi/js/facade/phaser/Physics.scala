package it.unibo.scafi.js.facade.phaser

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport
/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Physics.html]] */
@js.native
@JSImport("phaser", JSImport.Namespace)
object Physics extends js.Object {
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Physics.Matter.html]] */
  @js.native
  object Matter extends js.Object {
    @js.native
    trait MatterPhysics extends js.Object { /* todo */ }
  }
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Physics.Arcade.html]] */
  @js.native
  object Arcade extends js.Object {
    @js.native
    trait ArcadePhysics extends js.Object
  }
}
