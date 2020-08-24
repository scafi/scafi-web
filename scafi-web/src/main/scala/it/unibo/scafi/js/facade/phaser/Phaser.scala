package it.unibo.scafi.js.facade.phaser

import it.unibo.scafi.js.facade.phaser.Phaser.{Scene}
import org.scalajs.dom.raw.HTMLElement

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSGlobal, JSImport, JSName}
import scala.scalajs.js.|


@js.native
@JSImport("phaser", JSImport.Namespace)
object Phaser extends js.Object {
  @js.native
  class Game(config : GameConfig) extends js.Object
  @js.native
  trait Scene extends js.Object {
    def add : js.Any
  }
}

class SceneCallabackConfig(val preload: js.ThisFunction0[Scene, js.Any],
                           val create: js.ThisFunction0[Scene, js.Any],
                           val update: js.ThisFunction0[Scene, js.Any]) extends js.Object

class GameConfig(val width: Int,
                 val height: Int,
                 val parent: String | HTMLElement,
                 val transparent: Boolean,
                 val antialias: Boolean,
                 val scene : SceneCallabackConfig) extends js.Object
object SceneConfigHelper {

  def apply(preload: Scene => Unit, create: Scene => Unit, update: Scene => Unit) : SceneCallabackConfig = {
    implicit def wrapScene(logic : Scene => Unit) : js.ThisFunction0[Scene, js.Any] = (scene) => logic(scene)

    new SceneCallabackConfig(preload, create, update)
  }
}
