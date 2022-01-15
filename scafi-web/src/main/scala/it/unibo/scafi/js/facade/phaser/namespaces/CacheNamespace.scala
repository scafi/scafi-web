package it.unibo.scafi.js.facade.phaser.namespaces

import it.unibo.scafi.js.facade.phaser.Phaser

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal
/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Cache.html]] */
@js.native
@JSGlobal("Phaser.Cache")
object CacheNamespace extends js.Object {

  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Cache.CacheManager.html]] */
  @js.native
  class CacheManager(game: Phaser.Game) extends js.Object {
    val bitmapFont: BaseCache = js.native
    /* todo */
  }
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Cache.BaseCache.html]] */
  @js.native
  trait BaseCache extends js.Object {
    def exists(key: String): Boolean
  }
}
