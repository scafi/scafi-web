package it.unibo.scafi.js.facade.phaser.types

import it.unibo.scafi.js.facade.phaser.Phaser.Scene

import scala.scalajs.js
import scala.scalajs.js.{ThisFunction0, ThisFunction1, |}

package object scenes {
  type SceneCreateCallback = ThisFunction1[Scene, js.Any, Unit]
  type ScenePreloadCallback = ThisFunction0[Scene, Unit]
  type SceneInitCallback = ThisFunction1[Scene, js.Any, Unit]
  type UpdateCallback = ThisFunction0[Scene, Unit]
  type SceneSetting =
    SettingsConfig | js.Array[SettingsConfig] | CreateSceneFromObjectConfig | js.Array[CreateSceneFromObjectConfig]
  def callbacks(
      init: (Scene, js.Any) => Unit = (scene, any) => {},
      preload: (Scene) => Unit = scene => {},
      create: (Scene, js.Any) => Unit = (scene, any) => {},
      update: (Scene) => Unit = scene => {}
  ): CreateSceneFromObjectConfig = {
    val initJS: SceneCreateCallback = init
    val preloadJS: ScenePreloadCallback = preload
    val createJS: SceneInitCallback = create
    val updateJS: UpdateCallback = update
    new CreateSceneFromObjectConfig(
      js.defined(initJS),
      js.defined(preloadJS),
      js.defined(createJS),
      js.defined(updateJS)
    )
  }
}
