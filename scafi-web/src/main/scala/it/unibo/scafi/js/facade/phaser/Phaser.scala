package it.unibo.scafi.js.facade.phaser

import it.unibo.scafi.js.JSNumber
import org.scalajs.dom.raw.{CanvasRenderingContext2D, HTMLCanvasElement, HTMLDivElement, WebGLRenderingContext}

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport
import scala.scalajs.js.|

@js.native
@JSImport("phaser", JSImport.Namespace)
object Phaser extends js.Object {
  /* CONSTANT */
  val AUTO : Int = js.native
  val CANVAS : Int = js.native
  val WEBGL : Int = js.native
  val HEADLESS : Int = js.native
  val FOREVER : Int = js.native
  val UP : Int = js.native
  val DOWN : Int = js.native
  val RIGHT : Int = js.native
  val LEFT : Int = js.native
  /* CLASSES */
  @js.native
  class Game(conf : configuration.Game.Config) extends js.Object {
    /* members */
    var animis : Animations.AnimationManager = js.native
    var cache : Cache.CacheManager = js.native
    var canvas : HTMLCanvasElement = js.native
    val config : Core.Config = js.native
    var context : CanvasRenderingContext2D | WebGLRenderingContext = js.native
    var device : DeviceConf = js.native
    var domContainer :  HTMLDivElement = js.native
    var events : Events.EventEmitter = js.native
    //facebook todo
    val hasFocus : Boolean = js.native
    var input : Input.InputManager = js.native
    val isBooted : Boolean = js.native
    val isRunning : Boolean = js.native
    var plugins : Plugins.PluginManager = js.native
    var registry : Data.DataManager = js.native
    //var render : Render todo
    //var scale : Scale.ScaleManager
    //var scene : Scenes.SceneManager
    //var sound : todo
    //var textures : Textures.TextureManager
    /* methods */
    def destroy(removeCanvas : Boolean, noReturn : Boolean = js.native) : Unit = js.native
    def getFrame() : Int = js.native
    def getTime() : JSNumber = js.native
    def headlessStep(time : JSNumber, delta : JSNumber) : js.native = js.native
    def step(time : JSNumber, delta : JSNumber) : Unit = js.native
  }
  @js.native
  trait Scene extends js.Object {
    var input : Input.InputPlugin = js.native
    def add : GameObjects.GameObjectFactory
    def children : GameObjects.DisplayList
  }

  @js.native
  trait DeviceConf extends js.Object { /*todo*/ }

  @js.native
  object Core extends js.Object {
    @js.native
    trait Config extends js.Object { /* todo */ }

    @js.native
    trait TimeStep extends js.Object { /* todo */ }
  }
}