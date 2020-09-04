package it.unibo.scafi.js.facade.phaser.namespaces.input

import it.unibo.scafi.js.facade.phaser.Phaser.{Game, Scene}
import it.unibo.scafi.js.facade.phaser.namespaces.EventsNamespace

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal
import scala.scalajs.js.|

@js.native
@JSGlobal("Phaser.Input.Keyboard")
object KeyboardNamespace extends js.Object {
  /* todo static */
  @js.native
  trait KeyboardManager extends js.Object {
    /* members todo */
    var preventDefault : Boolean = js.native
  }
  @js.native
  trait KeyboardPlugin extends js.Object {
    def addKey(key : Key | String | Int, enableCapture : Boolean = js.native, emitOnRepeat : Boolean = js.native) : Key
    def addKeys(key : js.Array[Key | String | Int], enableCapture : Boolean = js.native, emitOnRepeat : Boolean = js.native) : js.Dictionary[Key]
    def removeKey(key : Key | String | Int, destroy : Boolean = js.native) : KeyboardPlugin = js.native
    def game : Game = js.native
    def scene : Scene = js.native
    /* todo */
  }

  @js.native
  object KeyCodes extends js.Object {
    val CTRL : Int = js.native
    val ALT : Int = js.native
    val ONE : Int = js.native
    val TWO : Int = js.native
    val THREE : Int = js.native
    val FOUR : Int = js.native
    val FIVE : Int = js.native
    val SIX : Int = js.native
    val SEVEN : Int = js.native
    val EIGHT : Int = js.native
    val NINE : Int = js.native
  }
  @js.native
  trait Key extends EventsNamespace.EventEmitter {
    def isDown : Boolean = js.native
    def isUp : Boolean = js.native
    def plugin : KeyboardPlugin = js.native
    /* todo */
  }

  @js.native
  object Events extends js.Object {
    val ANY_KEY_DOWN: String = js.native
    val ANY_KEY_UP: String = js.native
    val COMBO_MATCH: String = js.native
    val DOWN: String = js.native
    val KEY_DOWN: String = js.native
    val KEY_UP: String = js.native
    val UP: String = js.native
  }
}
