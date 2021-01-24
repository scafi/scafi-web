package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.utils.JSNumber

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal

/**
  * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Geom.html]]
  */
@js.native
@JSGlobal("Phaser.Geom")
object GeomNamespace extends js.Object {

  /**
    * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Geom.Rectangle.html]]
    */
  @js.native
  class Rectangle() extends js.Object {
    var x : JSNumber = js.native
    var y : JSNumber = js.native
    var width : JSNumber = js.native
    var height : JSNumber = js.native
    def contains(x : JSNumber, y : JSNumber) : Boolean = js.native
  }

  /**
    * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Geom.Point.html]]
    */
  @js.native
  class Point(val x : JSNumber = js.native, val y : JSNumber = js.native) extends js.Object

}
