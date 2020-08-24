package it.unibo.scafi.js.facade.phaser

import it.unibo.scafi.js.Nullable
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
    var activePointer : Pointer = js.native
    var canvas : HTMLCanvasElement = js.native
    var config : Phaser.Core.Config = js.native
    var defaultCursor : String = js.native
    var enabled : Boolean = js.native
    var events : Events.EventEmitter = js.native
    var globalTopOnly : Boolean = js.native
    val isOver : Boolean = js.native
    var keyboard : Nullable[Keyboard.KeyboardManager] = js.native
    var mouse : Nullable[Mouse.MouseManager] = js.native
    var mousePointer : Pointer = js.native
    var pointers : js.Array[Pointer] = js.native
    val pointersTotal : Int = js.native
    
    /* methods */
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
}
