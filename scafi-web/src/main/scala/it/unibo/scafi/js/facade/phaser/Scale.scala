package it.unibo.scafi.js.facade.phaser

import it.unibo.scafi.js.JSNumber

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport

@js.native
@JSImport("phaser", JSImport.Namespace)
object Scale extends js.Object {
  @js.native
  trait ScaleManager extends js.Object {
    var zoom : JSNumber
  }
}
