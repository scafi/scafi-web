package it.unibo.scafi.js.facade.phaser.configuration

import it.unibo.scafi.js.facade.phaser.Phaser.Scene

import scala.scalajs.js

object Scene {
  class HandlerConfiguration(val preload: js.ThisFunction0[Scene, Unit],
                             val init : js.ThisFunction1[Scene, js.Any, Unit],
                             val create: js.ThisFunction1[Scene, js.Any, Unit],
                             val update: js.ThisFunction0[Scene, Unit]) extends js.Object

  def callbacks(preload: Scene => Unit = scene => {},
                init : (Scene, js.Any) => Unit = (scene, data) => {},
                create: (Scene, js.Any) => Unit = (scene, data) => {},
                update: Scene => Unit = scene => {}) : HandlerConfiguration = {
    new HandlerConfiguration(preload, init,create, update)
  }
}
