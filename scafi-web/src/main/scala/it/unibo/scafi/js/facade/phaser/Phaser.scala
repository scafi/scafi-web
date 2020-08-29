package it.unibo.scafi.js.facade.phaser

import it.unibo.scafi.js.JSNumber
import it.unibo.scafi.js.facade.phaser.namespaces._
import org.scalajs.dom.raw.{CanvasRenderingContext2D, HTMLCanvasElement, HTMLDivElement, WebGLRenderingContext}

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport
import scala.scalajs.js.|
/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.html]] */
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
  /* NAMESPACES */
  val Input : InputNamespace = js.native
  val Loader : LoaderNamespace = js.native
  val Math : MathNamespace = js.native
  val GameObjects : GameObjectsNamespace = js.native
  val Geom : GeomNamespace = js.native
  val Physics : PhysicsNamespace = js.native
  val Plugins : PluginsNamespace = js.native
  val Renderer : RendererNamespace = js.native
  val Animations : AnimationsNamespace = js.native
  val Scale : ScaleNamespace = js.native
  val Cache : CacheNamespace = js.native
  val Cameras : CamerasNamespace = js.native
  val Data : DataNamespace = js.native
  val Scenes : ScenesNamespace = js.native
  val Textures : TexturesNamespace = js.native
  val Events : EventsNamespace = js.native
  val Time : TimeNamespace = js.native
  /* CLASSES */
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Game.html]] */
  @js.native
  class Game(conf : types.core.GameConfig) extends js.Object {
    /* members */
    def anims : Animations.AnimationManager = js.native
    def cache : Cache.CacheManager = js.native
    def canvas : HTMLCanvasElement = js.native
    val config : Core.Config = js.native
    def context : CanvasRenderingContext2D | WebGLRenderingContext = js.native
    def device : DeviceConf = js.native
    def domContainer :  HTMLDivElement = js.native
    def events : Events.EventEmitter = js.native
    //facebook todo
    val hasFocus : Boolean = js.native
    def input : Input.InputManager = js.native
    val isBooted : Boolean = js.native
    val isRunning : Boolean = js.native
    def loop : Core.TimeStep = js.native
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
  /* NAMESPACES */
  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Core.html]] */
  @js.native
  object Core extends js.Object {
    /* CLASSES */
    /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Core.Config.html]] */
    @js.native
    trait Config extends js.Object { /* todo */ }
    /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Core.Config.html]] */
    @js.native
    trait TimeStep extends js.Object { /* todo */ }
  }
}