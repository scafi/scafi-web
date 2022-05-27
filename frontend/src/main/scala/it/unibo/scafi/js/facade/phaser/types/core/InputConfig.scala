package it.unibo.scafi.js.facade.phaser.types.core

import it.unibo.scafi.js.CleanableObject

import scala.scalajs.js
import scala.scalajs.js.|
/** see @See [[https://photonstorm.github.io/phaser3-docs/Phaser.Types.Core.html.#InputConfig]] */
class InputConfig(
    val keyboard: js.UndefOr[Boolean | KeyboardInputConfig] = js.undefined,
    val mouse: js.UndefOr[Boolean | MouseInputConfig] = js.undefined
) extends CleanableObject {
  clean()
}
