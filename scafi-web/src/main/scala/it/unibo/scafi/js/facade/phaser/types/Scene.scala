package it.unibo.scafi.js.facade.phaser.types

import it.unibo.scafi.js.facade.phaser.Phaser

import scala.scalajs.js

object Scene {
  class HandlerConfiguration(val preload: js.ThisFunction0[Phaser.Scene, Unit],
                             val init : js.ThisFunction1[Phaser.Scene, js.Any, Unit],
                             val create: js.ThisFunction1[Phaser.Scene, js.Any, Unit],
                             val update: js.ThisFunction0[Phaser.Scene, Unit]) extends js.Object

  def callbacks(preload: Phaser.Scene => Unit = scene => {},
                init : (Phaser.Scene, js.Any) => Unit = (scene, data) => {},
                create: (Phaser.Scene, js.Any) => Unit = (scene, data) => {},
                update: Phaser.Scene => Unit = scene => {}) : HandlerConfiguration = {
    new HandlerConfiguration(preload, init,create, update)
  }

  class Settings(/* todo */) extends js.Object
}
