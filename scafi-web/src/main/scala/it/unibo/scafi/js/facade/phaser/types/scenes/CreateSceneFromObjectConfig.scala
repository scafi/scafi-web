package it.unibo.scafi.js.facade.phaser.types.scenes

import it.unibo.scafi.js.CleanableObject

import scala.scalajs.js

/**
  * @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Types.Scenes.html#.CreateSceneFromObjectConfig]]
  */
class CreateSceneFromObjectConfig(val init : js.UndefOr[SceneInitCallback] = js.undefined,
                                  val preload: js.UndefOr[ScenePreloadCallback] = js.undefined,
                                  val create : js.UndefOr[SceneCreateCallback] = js.undefined,
                                  val update : js.UndefOr[UpdateCallback] = js.undefined,
                                  val extend : js.UndefOr[js.Any] = js.undefined) extends CleanableObject {
  clean()
}
