package it.unibo.scafi.js.facade.phaser

import it.unibo.scafi.js.utils.JSNumber
import it.unibo.scafi.js.facade.phaser.Phaser.Loader
import it.unibo.scafi.js.facade.phaser.namespaces._
import org.scalajs.dom.raw.{CanvasRenderingContext2D, HTMLCanvasElement, HTMLDivElement, WebGLRenderingContext}

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSGlobal, JSImport}
import scala.scalajs.js.|
/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.html]] */
@js.native
@JSGlobal("Phaser")
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
  /* NAMESPACES */
  val Input : InputNamespace.type = js.native
  val Loader : LoaderNamespace.type = js.native
  val Math : MathNamespace.type = js.native
  val GameObjects : GameObjectsNamespace.type = js.native
  val Geom : GeomNamespace.type = js.native
  val Physics : PhysicsNamespace.type = js.native
  val Plugins : PluginsNamespace.type = js.native
  val Renderer : RendererNamespace.type = js.native
  val Animations : AnimationsNamespace.type = js.native
  val Scale : ScaleNamespace.type = js.native
  val Cache : CacheNamespace.type = js.native
  val Cameras : CamerasNamespace.type = js.native
  val Data : DataNamespace.type = js.native
  val Scenes : ScenesNamespace.type = js.native
  val Textures : TexturesNamespace.type = js.native
  val Events : EventsNamespace.type = js.native
  val Time : TimeNamespace.type = js.native
  val Core : CoreNamespace.type  = js.native
  /* CLASSES */
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Game.html]] */
  @js.native
  class Game(conf : types.core.GameConfig) extends js.Object {
    /* members */
    def anims : Animations.AnimationManager = js.native
    def cache : Cache.CacheManager = js.native
    def canvas : HTMLCanvasElement = js.native
    val config : CoreNamespace.Config = js.native
    def context : CanvasRenderingContext2D | WebGLRenderingContext = js.native
    def device : DeviceConf = js.native
    def domContainer :  HTMLDivElement = js.native
    def events : Events.EventEmitter = js.native
    //facebook todo
    val hasFocus : Boolean = js.native
    def input : Input.InputManager = js.native
    val isBooted : Boolean = js.native
    val isRunning : Boolean = js.native
    def loop : CoreNamespace.TimeStep = js.native
    def plugins : Plugins.PluginManager = js.native
    def registry : Data.DataManager = js.native
    def renderer : Renderer.Canvas.CanvasRender = js.native
    def scale : Scale.ScaleManager = js.native
    def scene : Scenes.SceneManager = js.native
    //var sound : todo
    def textures : Textures.TextureManager = js.native
    /* methods */
    def destroy(removeCanvas : Boolean, noReturn : Boolean = js.native) : Unit = js.native
    def getFrame() : Int = js.native
    def getTime() : JSNumber = js.native
    def headlessStep(time : JSNumber, delta : JSNumber) : js.native = js.native
    def step(time : JSNumber, delta : JSNumber) : Unit = js.native
  }
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Scene.html]] */
  @js.native
  class Scene(config : types.scenes.SceneSetting = js.native) extends js.Object {
    /* members */
    def add : GameObjects.GameObjectFactory = js.native
    def anims : Animations.AnimationManager = js.native
    def cache : Cache.CacheManager = js.native
    def cameras : Cameras.Scene2D.CameraManager = js.native
    def children : GameObjects.DisplayList = js.native
    def data : Data.DataManager = js.native
    def events : Events.EventEmitter = js.native
    //facebook todo
    def game : Game = js.native
    def input : Input.InputPlugin = js.native
    def lights : GameObjects.LightsManager = js.native
    def load : Loader.LoaderPlugin = js.native
    def make : GameObjects.GameObjectCreator = js.native
    def matter : Physics.Matter.MatterPhysics = js.native
    def plugins : Plugins.PluginManager = js.native
    def registry : Data.DataManager = js.native
    def scale : Scale.ScaleManager = js.native
    def physics : Physics.Arcade.ArcadePhysics = js.native
    def textures : Textures.TextureManager = js.native
    def sys : Scenes.Systems = js.native
    def time : Time.Clock = js.native
    /* members */
    def update(time : JSNumber, delta : JSNumber) : Unit = js.native
  }
  /* TYPES */
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser]] */
  @js.native
  trait DeviceConf extends js.Object { /*todo*/ }
}