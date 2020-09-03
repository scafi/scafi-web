package it.unibo.scafi.js.facade.phaser

import org.scalajs.dom.ext.Color

object Implicits {
  private val baseHex = 16
  implicit def colorConverter(color : Color) : Int  = Integer.parseInt(color.toHex.drop(1), baseHex)
}
