package it.unibo.scafi.js.facade.phaser.namespaces

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal

/**
 * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Core.html]]
 */
@js.native
@JSGlobal("Phaser.Core")
object CoreNamespace extends js.Object {
  /* NAMESPACE */
  val Events : EventsNamespace.type = js.native
  /* CLASSES */
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Core.Config.html]] */
  @js.native
  trait Config extends js.Object { /* todo */ }
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Core.Config.html]] */
  @js.native
  trait TimeStep extends js.Object { /* todo */ }
}