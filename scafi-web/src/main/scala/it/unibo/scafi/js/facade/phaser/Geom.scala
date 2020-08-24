package it.unibo.scafi.js.facade.phaser

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport

@js.native
@JSImport("phaser", JSImport.Namespace)
object Geom extends js.Object {
  @js.native
  class Rectangle() extends js.Object
  @js.native
  class Point() extends js.Object
}
