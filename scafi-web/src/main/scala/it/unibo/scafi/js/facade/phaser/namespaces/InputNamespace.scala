package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.facade.phaser.Phaser
import it.unibo.scafi.js.facade.phaser.namespaces.input.{InputEventsNamespace, KeyboardNamespace}
import it.unibo.scafi.js.utils.{JSNumber, Nullable}
import org.scalajs.dom.raw.HTMLCanvasElement

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSGlobal, JSName}

/**
  * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Input.html]]
  */
@js.native
@JSGlobal("Phaser.Input")
object InputNamespace extends js.Any {
  /* NAMESPACES */
  val Events: InputEventsNamespace.type = js.native
  val Keyboard: KeyboardNamespace.type = js.native

  /**
    * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Input.Mouse.html]]
    */
  @js.native
  object Mouse extends js.Object {

    /**
      * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Input.Mouse.MouseManager.html]]
      */
    @js.native
    trait MouseManager extends js.Object {
      /* todo */
      /* members */
      var capture: Boolean = js.native
    }

  }

  /**
    * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Input.Touch.html]]
    */
  @js.native
  object Touch extends js.Object {

    /**
      * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Input.Touch.TouchManager.html]]
      */
    @js.native
    trait TouchManager extends js.Object {
      /* todo */
    }

  }

  import Phaser._

  /* CLASSES */
  /**
    * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Input.InputManager.html]]
    */
  @js.native
  class InputManager(val game: Phaser.Game = js.native, conf: js.Object) extends js.Object {
    /* members */
    def activePointer: Pointer = js.native

    def canvas: HTMLCanvasElement = js.native

    def config: Phaser.Core.Config = js.native

    def defaultCursor: String = js.native

    def enabled: Boolean = js.native

    def events: Phaser.Events.EventEmitter = js.native

    def globalTopOnly: Boolean = js.native

    def isOver: Boolean = js.native

    def keyboard: Nullable[Keyboard.KeyboardManager] = js.native

    def mouse: Nullable[Mouse.MouseManager] = js.native

    def mousePointer: Pointer = js.native

    def pointers: js.Array[Pointer] = js.native

    def pointersTotal: Int = js.native

    val time: JSName = js.native

    /* methods */
    def addPointer(quantity: Int = js.native): Unit = js.native

    def destroy(): Unit = js.native

    def hitTest(pointer: Pointer, gameobjects: js.Array[GameObjects.GameObject],
                camera: Cameras.Scene2D.Camera, output: js.Array[GameObjects.GameObject] = js.native): Unit = js.native

    def pointWithinHitArea(gameObject: GameObjects.GameObject, x: JSNumber, y: JSNumber): Boolean = js.native

    def pointWithinInteractiveObject(gameObject: GameObjects.GameObject, x: JSNumber, y: JSNumber): Boolean = js.native

    def setDefaultCursor(cursor: String): Unit = js.native

    def transformPointer(pointer: Pointer, pageX: JSNumber, pageY: JSNumber, wasMove: Boolean): Unit = js.native

    def updateInputPlugins(tpe: Int, pointers: js.Array[Pointer]): Unit = js.native
  }

  /**
    * #see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Input.Pointer.html]]
    */
  @js.native
  trait Pointer extends js.Object {
    /* members */
    var x: JSNumber = js.native
    var y: JSNumber = js.native
    var worldX: JSNumber = js.native
    var worldY: JSNumber = js.native
    var deltaX: JSNumber = js.native
    var deltaY: JSNumber = js.native
    var deltaZ: JSNumber = js.native
    var primaryDown: Boolean = js.native
    var isDown: Boolean = js.native
  }

  /**
    * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Input.InputPlugin.html]]
    */
  @js.native
  trait InputPlugin extends js.Object with Phaser.Events.EventEmitter {
    /* fields */
    var keyboard: Nullable[Keyboard.KeyboardPlugin] = js.native
    val scene: Scene = js.native
    var enabled: Boolean = js.native

    /* methods */
    def setDraggable(gameObject: GameObjects.GameObject, value: Boolean = js.native): Unit = js.native
  }

}
