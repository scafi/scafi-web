package it.unibo.scafi.js.facade.phaser

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport
import scala.scalajs.js.|

/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Loader.html]] */
@js.native
@JSImport("phaser", JSImport.Namespace)
object Loader extends js.Object {
  @js.native
  class LoaderPlugin(val scene : Phaser.Scene) extends js.Object {
    /* todo */
    def bitmapFont(key : String, textureUrl : String | js.Array[String] = js.native, fontDataURL : String = js.native) : LoaderPlugin = js.native
  }
}
