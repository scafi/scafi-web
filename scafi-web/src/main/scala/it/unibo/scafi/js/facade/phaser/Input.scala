package it.unibo.scafi.js.facade.phaser

import it.unibo.scafi.js.{JSNumber, Nullable}
import org.scalajs.dom.raw.HTMLCanvasElement

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSImport, JSName}
import scala.scalajs.js.|

@js.native
@JSImport("phaser", JSImport.Namespace)
object Input extends js.Object {
  @js.native
  class InputManager(val game : Phaser.Game = js.native, conf : js.Object) extends js.Object {
    /* members */
    def activePointer : Pointer = js.native
    def canvas : HTMLCanvasElement = js.native
    def config : Phaser.Core.Config = js.native
    def defaultCursor : String = js.native
    def enabled : Boolean = js.native
    def events : Events.EventEmitter = js.native
    def globalTopOnly : Boolean = js.native
    def isOver : Boolean = js.native
    def keyboard : Nullable[Keyboard.KeyboardManager] = js.native
    def mouse : Nullable[Mouse.MouseManager] = js.native
    def mousePointer : Pointer = js.native
    def pointers : js.Array[Pointer] = js.native
    def pointersTotal : Int = js.native
    val time : JSName = js.native

    /* methods */
    def addPointer(quantity : Int = js.native) : Unit = js.native
    def destroy() : Unit = js.native
    def hitTest(pointer: Pointer, gameobjects : js.Array[GameObjects.GameObject],
                camera : Scene2D.Camera, output : js.Array[GameObjects.GameObject] = js.native): Unit = js.native
    def pointWithinHitArea(gameObject: GameObjects.GameObject, x : JSNumber, y : JSNumber) : Boolean = js.native
    def pointWithinInteractiveObject(gameObject: GameObjects.GameObject, x : JSNumber, y : JSNumber) : Boolean = js.native
    def setDefaultCursor(cursor : String) : Unit = js.native
    def transformPointer(pointer : Pointer, pageX : JSNumber, pageY : JSNumber, wasMove : Boolean) : Unit = js.native
    def updateInputPlugins(tpe : Int, pointers : js.Array[Pointer]) : Unit = js.native
  }
  @js.native
  trait Pointer extends js.Object {}

  @js.native
  object Keyboard extends js.Object {
    @js.native
    trait KeyboardManager extends js.Object { /* todo */ }
  }

  @js.native
  object Mouse extends js.Object {
    @js.native
    trait MouseManager extends js.Object { /* todo */ }
  }

  @js.native
  object Touch extends js.Object {
    @js.native
    trait TouchManager extends js.Object { /* todo */ }
  }
  @js.native
  trait InputPlugin extends js.Object {
    /* fields */

    /* methods */
    def setDraggable(gameobject : GameObjects.GameObject) : Unit = js.native
  }
}
