package it.unibo.scafi.js.view.dynamic
import it.unibo.scafi.core.Core
import it.unibo.scafi.js.Debug
import it.unibo.scafi.js.utils.JSNumber
import it.unibo.scafi.js.facade.phaser.Phaser._
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.{Arc, Container}
import it.unibo.scafi.js.facade.phaser.namespaces.ScaleNamespace.ScaleModes
import it.unibo.scafi.js.facade.phaser.types.core._
import it.unibo.scafi.js.facade.phaser.types.physics.arcade.ArcadeWorldConfig
import it.unibo.scafi.js.facade.phaser.{Phaser, types}
import it.unibo.scafi.js.model.Graph
import org.scalajs.dom.ext.Color
import org.scalajs.dom.raw.HTMLElement

import scala.scalajs.js
class PhaserGraphSection(paneSection : HTMLElement, interaction : ((Game, Scene, Container) => Unit)) extends (Graph => Unit) {
  import Phaser._
  import it.unibo.scafi.js.facade.phaser.Implicits._
  private var model : (Option[Graph], Boolean) = (Option.empty[Graph], false)
  private val size = 5 //TODO put in configuration
  private val nodeColor : Int = Color.Magenta //TODO put in configuration
  private val lineColor : Int = Color.Cyan //TODO put in configuration
  private val fontSize : Int = 10 //TODO put in configuration
  private val config = new GameConfig(
    parent = paneSection,
    scene = sceneHandler,
    physics = new PhysicsConfig(default = PhysicsConfig.ARCADE, arcade = new ArcadeWorldConfig()),
    scale = new ScaleConfig(mode = ScaleModes.RESIZE),
    input = new InputConfig (
      mouse = new MouseInputConfig(capture = false),
      keyboard = new KeyboardInputConfig(target = paneSection)
    )
  )
  private val game = new Phaser.Game(config)
  protected var mainContainer : GameObjects.Container = _
  protected var vertexContainer : GameObjects.Container = _
  protected var nodeContainer : GameObjects.Container = _
  protected var labelContainer : GameObjects.Container = _

  private lazy val sceneHandler : types.scenes.CreateSceneFromObjectConfig =  types.scenes.callbacks(
    preload = (scene) => {
      //TODO put in configuration via webpack
      scene.load.bitmapFont("font", "http://labs.phaser.io/assets/fonts/bitmap/atari-smooth.png", "http://labs.phaser.io/assets/fonts/bitmap/atari-smooth.xml")
    },
    create = (scene, _) => {
      val mainCamera = scene.cameras.main
      mainCamera.zoom = 1
      vertexContainer = scene.add.container(0, 0)
      labelContainer = scene.add.container(0, 0)
      nodeContainer = scene.add.container(0, 0)
      mainContainer = scene.add.container(0, 0, js.Array(vertexContainer, nodeContainer, labelContainer))
      mainContainer.setSize(Int.MaxValue, Int.MaxValue)
      interaction(game, scene, mainContainer)
      scene.input.on(Phaser.Input.Events.POINTER_WHEEL, (self : js.Any, pointer : js.Any, _ : js.Any, dx : JSNumber, dy : JSNumber, dz : JSNumber) => {
        mainCamera.zoom -= (dy / 1000)
      })
    },
    update = scene => {
      model match {
        case (Some(graph), true) => onNewGraph(graph, scene)
        case (Some(graph), false) => onSameGraph(graph, scene)
        case _ =>
      }
    }
  )

  override def apply(v1: Graph): Unit = model = (Some(v1), true)

  private def onSameGraph(graph : Graph, scene : Phaser.Scene) : Unit = ()

  private def onNewGraph(graph : Graph, scene : Phaser.Scene) : Unit = {
    //TODO improve performance (e.g. via caching)
    vertexContainer.removeAll(true)
    nodeContainer.removeAll(true)
    labelContainer.removeAll(true)

    graph.vertices.map(vertex =>  (graph(vertex.from), graph(vertex.to)))
      .map { case (from, to) => scene.add.line(x1 = from.position.x, y1 = from.position.y, x2 = to.position.x, y2 = to.position.y, strokeColor = lineColor ) }
      .map { _.setOrigin(0)}
      .foreach(vertexContainer.add(_))

    val nodes = graph.nodes.map(node => {
      val circle = scene.add.circle(node.position.x, node.position.y, size, nodeColor)
      circle.setData("id", node.id)
    })
    nodes.foreach(nodeContainer.add(_))
    import js.JSConverters._
    scene.physics.add.staticGroup(nodes.toJSArray)

    graph.nodes.map(node => node -> node.labels.map(onLabel).toList)
        .map { case (node, labelList) => node -> (s"${node.id}" :: labelList).mkString("\n")}
        .map { case (node, labelList) => scene.add.bitmapText(node.position.x , node.position.y, "font", labelList, fontSize)}
        .map(_.setLeftAlign())
        .foreach(labelContainer.add(_))

    graph.nodes.map(node => node -> node.labels.map(onLabel).toList)
      .map { case (node, labelList) => node -> (s"${node.id}" :: Nil).mkString("\n")}
      .map { case (node, labelList) => scene.add.bitmapText(node.position.x , node.position.y, "font", labelList, fontSize)}
      .map(_.setLeftAlign())
      .foreach(labelContainer.add(_))

    model = model.copy(_2 = false)
  }

  private def onLabel(label : (String, Any)) : String = label match {
    case (_, e: Core#Export) => e.root[Any]() match {
      case (other : Double) => ""  + other.toInt
      case other => other.toString
    }
    case (_, other: Double) => "" + other.toInt
    case (_, e) => e.toString
  }
}