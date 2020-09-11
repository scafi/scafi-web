package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.facade.phaser.Phaser
import it.unibo.scafi.js.facade.phaser.types.loader.XHRSettingsObject

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal
import scala.scalajs.js.|

/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Loader.html]] */
@js.native
@JSGlobal("Phaser.Loader")
object LoaderNamespace extends js.Object {

  /**
    * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Loader.LoaderPlugin.html]]
    */
  @js.native
  class LoaderPlugin(val scene : Phaser.Scene) extends js.Object {
    /* todo */
    def bitmapFont(key : String,
                   textureUrl : String | js.Array[String] = js.native,
                   fontDataURL : String = js.native,
                   textureXhrSettings : XHRSettingsObject = js.native,
                   fontDataXhrSettings : XHRSettingsObject = js.native
                  ) : LoaderPlugin = js.native
  }
}
