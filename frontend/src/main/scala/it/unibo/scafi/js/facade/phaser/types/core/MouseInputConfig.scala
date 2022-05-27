package it.unibo.scafi.js.facade.phaser.types.core

import it.unibo.scafi.js.CleanableObject
import org.scalajs.dom.Element

import scala.scalajs.js
/** see @See [[https://photonstorm.github.io/phaser3-docs/Phaser.Types.Core.html.#MouseInputConfig]] */
class MouseInputConfig(val target: js.UndefOr[Element] = js.undefined, val capture: Boolean = true)
    extends CleanableObject {
  clean()
}
