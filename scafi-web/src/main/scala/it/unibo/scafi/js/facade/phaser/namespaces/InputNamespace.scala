package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.facade.phaser.Phaser
import it.unibo.scafi.js.{JSNumber, Nullable}
import org.scalajs.dom.raw.HTMLCanvasElement

import scala.scalajs.js
import scala.scalajs.js.annotation.JSName
import scala.scalajs.js.|

@js.native
trait InputNamespace extends js.Any {
  import Phaser._
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
                camera : Cameras.Scene2D.Camera, output : js.Array[GameObjects.GameObject] = js.native): Unit = js.native
    def pointWithinHitArea(gameObject: GameObjects.GameObject, x : JSNumber, y : JSNumber) : Boolean = js.native
    def pointWithinInteractiveObject(gameObject: GameObjects.GameObject, x : JSNumber, y : JSNumber) : Boolean = js.native
    def setDefaultCursor(cursor : String) : Unit = js.native
    def transformPointer(pointer : Pointer, pageX : JSNumber, pageY : JSNumber, wasMove : Boolean) : Unit = js.native
    def updateInputPlugins(tpe : Int, pointers : js.Array[Pointer]) : Unit = js.native
  }
  @js.native
  trait Pointer extends js.Object {
    /* members */
    var x : JSNumber = js.native
    var y : JSNumber = js.native
    var worldX : JSNumber = js.native
    var worldY : JSNumber = js.native
    var deltaX : JSNumber = js.native
    var deltaY : JSNumber = js.native
    var deltaZ : JSNumber = js.native
  }

  @js.native
  object Keyboard extends js.Object {
    /* todo static */
    @js.native
    trait KeyboardManager extends js.Object {
      /* members todo */
     }
    @js.native
    trait KeyboardPlugin extends js.Object {
      def addKey(key : Key | String | Int, enableCapture : Boolean = js.native, emitOnRepeat : Boolean = js.native) : Key
      def addKeys(key : js.Array[Key | String | Int], enableCapture : Boolean = js.native, emitOnRepeat : Boolean = js.native) : js.Dictionary[Key]
      /* todo */
    }

    @js.native
    object KeyCodes extends js.Object {
      val CTRL : Int = js.native
    }
    @js.native
    trait Key extends js.Object {
      def isDown : Boolean = js.native
      def isUp : Boolean = js.native
      /* todo */
    }
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
  trait InputPlugin extends js.Object with Events.EventEmitter {
    /* fields */
    var keyboard : Nullable[Keyboard.KeyboardPlugin] = js.native
    /* methods */
    def setDraggable(gameobject : GameObjects.GameObject) : Unit = js.native
  }
}
