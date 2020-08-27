package it.unibo.scafi.js.view.dynamic
import it.unibo.scafi.js.JSNumber
import it.unibo.scafi.js.facade.phaser.Phaser.Scene
import it.unibo.scafi.js.facade.phaser.types.{Game}
import it.unibo.scafi.js.facade.phaser.types
import it.unibo.scafi.js.facade.phaser.{Components, GameObjects, Phaser}
import it.unibo.scafi.js.model.Graph

import scala.scalajs.js
import scala.scalajs.js.{ThisFunction3, ThisFunction4}

class PhaserGraphPane(paneId : String) extends (Graph => Unit) {
  private var model : (Option[Graph], Boolean) = (Option.empty[Graph], false)
  private val radius = 5 //TODO put in configuration
  private val nodeColor : Int = 0xff00ff //TODO put in configuration
  private val lineColor : Int = 0x0000ff //TODO put in configuration
  private val fontSize : Int = 7 //TODO put in configuration
  private val game = new Phaser.Game(
    new Game.Config(
      parent = paneId,
      scene = sceneHandler
    )
  )

  var mainContainer : GameObjects.Container = _
  private lazy val sceneHandler = types.Scene.callbacks(
    preload = (scene) => {
      scene.load.bitmapFont("font", "http://labs.phaser.io/assets/fonts/bitmap/atari-smooth.png", "http://labs.phaser.io/assets/fonts/bitmap/atari-smooth.xml")
    },
    create = (scene, _) => {
      mainContainer = scene.add.container(0, 0)
      mainContainer.setSize(Int.MaxValue, Int.MaxValue)
      mainContainer.setInteractive()
      mainContainer.on("drag", dragFunction)
      mainContainer.on("wheel", (_ : js.Any, _ : js.Any, _ : Double, dy : Double, _ : Double, _ : js.Any) => {
        mainContainer.scale += dy / 1000
      })
      scene.input.setDraggable(mainContainer)
    },
    update = scene => model match {
      case (Some(graph), true) => onNewGraph(graph, scene)
      case (Some(graph), false) => onSameGraph(graph, scene)
      case _ =>
    }
  )
  private val dragFunction : ThisFunction4[Components.Transform, Components.Transform, JSNumber, JSNumber, js.Any, Unit] = {
    (obj, self, dragX, dragY, _) => {
      obj.x = dragX
      obj.y = dragY
    }
  }

  override def apply(v1: Graph): Unit = { model = (Some(v1), true) }
var done = false
  private def onSameGraph(graph : Graph, scene : Phaser.Scene) : Unit = {}

  private def onNewGraph(graph : Graph, scene : Phaser.Scene) : Unit = {
    mainContainer.removeAll(true)

    graph.vertices.map(vertex =>  (graph(vertex.from), graph(vertex.to)))
      .map { case (from, to) => scene.add.line(x1 = from.position.x, y1 = from.position.y, x2 = to.position.x, y2 = to.position.y, strokeColor = lineColor ) }
      .map { _.setOrigin[GameObjects.Line](0)}
      .foreach(mainContainer.add(_))

    graph.nodes.map(node => scene.add.circle(node.position.x, node.position.y, radius, nodeColor))
      .foreach(mainContainer.add(_))

    graph.nodes.map(node => node -> node.labels.map(label => s"${label.value.toString}").toList)
        .map { case (node, labelList) => node -> (s"id:${node.id}" :: labelList).mkString("\n")}
        .map { case (node, labelList) => scene.add.bitmapText(node.position.x, node.position.y, "font", labelList, fontSize)}
        .map(_.setLeftAlign())
        .foreach(mainContainer.add(_))


    model = model.copy(_2 = false)
  }
}
