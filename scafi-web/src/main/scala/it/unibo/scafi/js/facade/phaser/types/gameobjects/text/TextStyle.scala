package it.unibo.scafi.js.facade.phaser.types.gameobjects.text

import it.unibo.scafi.js.CleanableObject

import scala.scalajs.js

/**
  * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Types.GameObjects.Text.html#.TextStyle]]
  */
class TextStyle(val metrics : js.UndefOr[TextMetrics]) extends CleanableObject {
  clean()
}
