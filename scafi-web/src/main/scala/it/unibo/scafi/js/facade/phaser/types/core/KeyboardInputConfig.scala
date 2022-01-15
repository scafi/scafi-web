package it.unibo.scafi.js.facade.phaser.types.core

import it.unibo.scafi.js.CleanableObject
import org.scalajs.dom.Element

import scala.scalajs.js
/** see @See [[https://photonstorm.github.io/phaser3-docs/Phaser.Types.Core.html.#KeyboardInputConfig]] */
class KeyboardInputConfig(
    val target: js.UndefOr[js.Any] = js.undefined,
    val capture: js.UndefOr[js.Array[Int]] = js.undefined
) extends CleanableObject {
  clean()
}
