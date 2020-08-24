package it.unibo.scafi.js.facade.phaser.configuration

import it.unibo.scafi.js.JSNumber
import it.unibo.scafi.js.facade.phaser.GameObjects.GameObject
import it.unibo.scafi.js.facade.phaser.GameObjects.Shape
import it.unibo.scafi.js.facade.phaser.Scene2D
import org.scalajs.dom.window
import scala.scalajs.js
import scala.scalajs.js.|

object Input {

  class Config(
                val keyboard : Boolean | KeyboardConfig = true,
                val mouse : Boolean | MouseConfig = true,
                val touch : Boolean | TouchConfig = true,
                val gamepad : Boolean | GamepadConfig = false,
                val activePointers : Int = 1,
                val smoothFactor : JSNumber = 0,
                val windowEvents : Boolean = true
              ) extends js.Object

  class KeyboardConfig(val target : js.Any = window, capture : js.Array[Int] = js.Array()) extends js.Object
  class MouseConfig(val target : js.Any = null, capture : Boolean = true) extends js.Object
  class TouchConfig(val target : js.Any = null, capture : Boolean = true) extends js.Object
  class GamepadConfig(val target : js.Any = window) extends js.Object

  trait InteractiveObject extends js.Object {
    var gameObject : GameObject
    var enabled : Boolean
    var alwaysEnabled : Boolean
    var draggable : Boolean
    var dropZone : Boolean
    var cursors : Boolean | String
    var target : GameObject
    var camera : Scene2D.Camera
    var hitArea : js.Any
    var hitAreaCallback : js.Function4[Any, JSNumber, JSNumber, GameObject, Unit]
    var hitAreaDebug : Shape
    var customHitArea : Boolean
    var localX : JSNumber
    var localY : JSNumber
    var dragStartX : JSNumber
    var dragStartY : JSNumber
    var dragStartXGlobal : JSNumber
    var dragStartYGlobal : JSNumber
    var dragX : JSNumber
    var dragY : JSNumber
    var dragState : JSNumber // 0 | 1 | 2
  }
}
