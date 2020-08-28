package it.unibo.scafi.js.view.dynamic
import it.unibo.scafi.core.Core
import it.unibo.scafi.js.JSNumber
import it.unibo.scafi.js.facade.phaser.types.Game
import it.unibo.scafi.js.facade.phaser.{Phaser, types}
import it.unibo.scafi.js.model.Graph
import org.scalajs.dom.raw.HTMLElement

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSExportAll, JSExportTopLevel}
import scala.scalajs.js.{ThisFunction4, |}

class PhaserGraphSection(paneSection : String | HTMLElement) extends (Graph => Unit) {
  import Phaser._
  private var model : (Option[Graph], Boolean) = (Option.empty[Graph], false)
  private val radius = 5 //TODO put in configuration
  private val nodeColor : Int = 0xff00ff //TODO put in configuration
  private val lineColor : Int = 0x0000ff //TODO put in configuration
  private val fontSize : Int = 7 //TODO put in configuration
  private val game = new Phaser.Game(
    new Game.Config(
      parent = paneSection,
      scene = sceneHandler
    )
  )

  var mainContainer : GameObjects.Container = _
  private lazy val sceneHandler : types.Scene.HandlerConfiguration = types.Scene.callbacks(
    preload = (scene) => {
      //TODO put in configuration
      scene.load.bitmapFont("font", "http://labs.phaser.io/assets/fonts/bitmap/atari-smooth.png", "http://labs.phaser.io/assets/fonts/bitmap/atari-smooth.xml")
    },
    create = (scene, _) => {
      val mainCamera = scene.cameras.main
      mainContainer = scene.add.container(0, 0)
      mainContainer.setSize(Int.MaxValue, Int.MaxValue)
      mainContainer.setInteractive()
      mainContainer.on("drag", dragFunction)
      scene.input.on("wheel", (self : js.Any, pointer : js.Any, _ : js.Any, dx : JSNumber, dy : JSNumber, dz : JSNumber) => {
        mainCamera.zoom -= (dy / 1000)
      })
      scene.input.setDraggable(mainContainer)
    },
    update = scene => {
      val drag = scene.input.keyboard.get.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL)
      if(drag.isDown) {
        mainContainer.setInteractive()
        this.game.canvas.style.cursor = "grab"
      } else {
        mainContainer.disableInteractive()
        this.game.canvas.style.cursor = "auto"
      }
      model match {
        case (Some(graph), true) => onNewGraph(graph, scene)
        case (Some(graph), false) => onSameGraph(graph, scene)
        case _ =>
      }
    }
  )
  import Phaser.GameObjects.Components._
  private val dragFunction : ThisFunction4[Transform,Transform, JSNumber, JSNumber, js.Any, Unit] = {
    (obj, _, dragX, dragY, _) => {
      obj.x = dragX
      obj.y = dragY
    }
  }

  override def apply(v1: Graph): Unit = { model = (Some(v1), true) }

  private def onSameGraph(graph : Graph, scene : Phaser.Scene) : Unit = {}

  private def onNewGraph(graph : Graph, scene : Phaser.Scene) : Unit = {
    mainContainer.removeAll(true)

    graph.vertices.map(vertex =>  (graph(vertex.from), graph(vertex.to)))
      .map { case (from, to) => scene.add.line(x1 = from.position.x, y1 = from.position.y, x2 = to.position.x, y2 = to.position.y, strokeColor = lineColor ) }
      .map { _.setOrigin[GameObjects.Line](0)}
      .foreach(mainContainer.add(_))

    graph.nodes.map(node => scene.add.circle(node.position.x, node.position.y, radius, nodeColor))
      .foreach(mainContainer.add(_))

    graph.nodes.map(node => node -> node.labels.map(onLabel).toList)
        .map { case (node, labelList) => node -> (s"id:${node.id}" :: labelList).mkString("\n")}
        .map { case (node, labelList) => scene.add.bitmapText(node.position.x, node.position.y, "font", labelList, fontSize)}
        .map(_.setLeftAlign())
        .foreach(mainContainer.add(_))

    model = model.copy(_2 = false)
  }

  private def onLabel(label : (String, Any)) : String = label match {
    case (_, e : Core#Export) => e.root[Any]().toString
    case (_, any) => any.toString
  }
}
