package it.unibo.scafi.js.facade.phaser.namespaces.physics


import it.unibo.scafi.js.utils.JSNumber

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal


/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Physics.Arcade.html]] */
@js.native
@JSGlobal("Phaser.Physics.Arcade")
object ArcadeNamespace extends js.Object {
  import it.unibo.scafi.js.facade.phaser.Phaser._
  /* NAMESPACES */

  /* CLASSES */
  @js.native
  trait ArcadePhysics extends js.Object {
    /* members */
    def add : Factory
    /* methods */
    def overlapRect(x : JSNumber,
                    y : JSNumber,
                    width : JSNumber,
                    height : JSNumber,
                    includeDynamic : Boolean = js.native,
                    includeStatic : Boolean = js.native) : js.Array[Body]
  }

  @js.native
  trait Factory extends js.Object {
    /* methods */
    def staticGroup[G <: GameObjects.GameObject](children : js.Array[G] = js.native, config : js.Any = js.native) : StaticGroup

  }
  @js.native
  trait StaticGroup extends js.Object {
    /* todo */
    def add(child : GameObjects.GameObject, addToScene : Boolean = js.native) : StaticGroup
  }
  @js.native
  trait Body extends js.Object {
    /* members */
    var gameObject : GameObjects.GameObject = js.native
    var x : JSNumber = js.native
    var y : JSNumber = js.native
    var center : Math.Vector2 = js.native
    val width : JSNumber = js.native
    val halfWidth : JSNumber = js.native
  }
  @js.native
  trait StaticBody extends js.Object {

  }
}
