package it.unibo.scafi.js.facade.phaser.types.input

import it.unibo.scafi.js.utils.JSNumber
import it.unibo.scafi.js.facade.phaser.Phaser

import scala.scalajs.js
import scala.scalajs.js.|

/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Types.Input.html#.InteractiveObject]] */
trait InteractiveObject extends js.Object {
  var gameObject: Phaser.GameObjects.GameObject
  var enabled: Boolean
  var alwaysEnabled: Boolean
  var draggable: Boolean
  var dropZone: Boolean
  var cursors: Phaser.GameObjects.GameObject | String
  var target: Phaser.GameObjects.GameObject
  var camera: Phaser.Cameras.Scene2D.Camera
  var hitArea: js.Any
  var hitAreaCallback: js.Function4[Any, JSNumber, JSNumber, Phaser.GameObjects.GameObject, Unit]
  var hitAreaDebug: Phaser.GameObjects.Shape
  var customHitArea: Boolean
  var localX: JSNumber
  var localY: JSNumber
  var dragStartX: JSNumber
  var dragStartY: JSNumber
  var dragStartXGlobal: JSNumber
  var dragStartYGlobal: JSNumber
  var dragX: JSNumber
  var dragY: JSNumber
  var dragState: JSNumber // 0 | 1 | 2
}
