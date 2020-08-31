package it.unibo.scafi.js.facade.phaser.types.input

import it.unibo.scafi.js.CleanableObject

import scala.scalajs.js
import scala.scalajs.js.{ThisFunction, ThisFunction1}

class InputConfiguration(val draggable : Boolean = false,
                         val hitAreaCallback  : js.UndefOr[ThisFunction] = js.undefined) extends CleanableObject {

}
