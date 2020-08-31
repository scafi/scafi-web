package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.facade.phaser.namespaces.physics.ArcadeNamespace

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal

/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Physics.html]] */
@js.native
@JSGlobal("Phaser.Physics")
object PhysicsNamespace extends js.Object {
  /* NAMESPACE */
  val Arcade : ArcadeNamespace.type = js.native

  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Physics.Matter.html]] */
  @js.native
  object Matter extends js.Object {
    @js.native
    trait MatterPhysics extends js.Object { /* todo */ }
  }
}
