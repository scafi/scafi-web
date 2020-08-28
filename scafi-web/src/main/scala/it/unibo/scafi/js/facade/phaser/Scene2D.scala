package it.unibo.scafi.js.facade.phaser

import it.unibo.scafi.js.JSNumber

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport
import scala.scalajs.js.|


@js.native
@JSImport("phaser", JSImport.Namespace)
object Scene2D extends js.Object {
  @js.native
  trait Camera extends js.Object {
    var zoom : JSNumber = js.native

    def zoomTo(zoom : JSNumber,
               duration : Int = js.native,
               ease : String | js.Function = js.native,
               force : Boolean = js.native,
               callback : js.Any = js.native,
               context : js.Any = js.native)
  }
  @js.native
  trait CameraManager extends js.Object {
    /* members */
    def main : Camera
  }
}
