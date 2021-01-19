package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.controller.local.{GridLikeNetwork, RandomNetwork, SupportConfiguration}
import it.unibo.scafi.js.facade.phaser.Phaser._
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.{Container, GameObject}
import it.unibo.scafi.js.facade.phaser.namespaces.ScaleNamespace.ScaleModes
import it.unibo.scafi.js.facade.phaser.types.core._
import it.unibo.scafi.js.facade.phaser.types.physics.arcade.ArcadeWorldConfig
import it.unibo.scafi.js.facade.phaser.{Phaser, types}
import it.unibo.scafi.js.model.{Graph, Node}
import it.unibo.scafi.js.utils.JSNumber
import it.unibo.scafi.js.view.dynamic.graph.LabelRender.LabelRender
import it.unibo.scafi.js.view.dynamic.graph.PhaserGraphSection.{Bound, ForceRepaint}
import it.unibo.scafi.js.view.dynamic.{EventBus, VisualizationSettingsSection}
import org.scalajs.dom.ext.Color
import org.scalajs.dom.raw.HTMLElement

import scala.scalajs.js
class PhaserGraphSection(paneSection : HTMLElement,
                         interaction : ((Scene, NodeDescriptionPopup, Container) => Unit),
                         settings: VisualizationSettingsSection,
                         labelRenders : Seq[LabelRender]) extends (Graph => Unit) {
  import NodeRepresentation._
  import Phaser._
  import it.unibo.scafi.js.facade.phaser.Implicits._
  private var model : (Option[Graph], Boolean) = (Option.empty[Graph], false)
  private val size = 5 //TODO put in configuration
  private var newBound : Option[Bound] = None
  private val nodeColor : Int = Color(187, 134, 252) //TODO put in configuration
  private val lineColor : Int = Color(125, 125, 125) //TODO put in configuration
  private val cameraSlack = - 0.1
  private val noSlack = 0.0
  private val config = new GameConfig(
    parent = paneSection,
    scene = sceneHandler,
    physics = new PhysicsConfig(default = PhysicsConfig.ARCADE, arcade = new ArcadeWorldConfig()),
    scale = new ScaleConfig(mode = ScaleModes.RESIZE),
    input = new InputConfig (
      mouse = new MouseInputConfig(capture = false),
      keyboard = new KeyboardInputConfig(target = paneSection)
    ),
    dom = new DOMContainerConfig(createContainer = true),
    transparent = true
  )
  private val game = new Phaser.Game(config)
  private var popup : NodeDescriptionPopup = _
  private var mainContainer : GameObjects.Container = _
  private var vertexContainer : GameObjects.Container = _
  private var nodeContainer : GameObjects.Container = _
  private var labelContainer : GameObjects.Container = _
  private lazy val sceneHandler : types.scenes.CreateSceneFromObjectConfig =  types.scenes.callbacks(
    preload = scene => labelRenders.foreach(_.onInit(scene)),
    create = (scene, _) => {
      val mainCamera = scene.cameras.main
      mainCamera.zoom = 1

      vertexContainer = scene.add.container(0, 0)
      labelContainer = scene.add.container(0, 0)
      nodeContainer = scene.add.container(0, 0)
      mainContainer = scene.add.container(0, 0, js.Array(vertexContainer, nodeContainer, labelContainer))
      popup = NodeDescriptionPopup(mainContainer, scene)
      mainContainer.setSize(Int.MaxValue, Int.MaxValue)
      interaction(scene, popup, mainContainer)
      scene.input.on(Phaser.Input.Events.POINTER_WHEEL, (_ : js.Any, _ : js.Any, _ : js.Any, _ : JSNumber, dy : JSNumber, _ : JSNumber) => {
        mainCamera.zoom -= (dy / 1000)
      })
    },
    update = scene => {
      newBound.foreach(bound => adjustScene(bound, scene))
      newBound = None
      model match {
        case (Some(graph), true) => onNewGraph(graph, scene)
        case (Some(graph), false) => onSameGraph(graph, scene)
        case _ =>
      }
    }
  )
  override def apply(v1: Graph): Unit = model = (Some(v1), true)
  EventBus.listen {
    case ForceRepaint => model = model.copy(_2 = true)
    case SupportConfiguration(_ @ RandomNetwork(min, max, _), _, _, _, _) => newBound = Some(Bound(min, min, max, max))
    case SupportConfiguration(_ @ GridLikeNetwork(row, col, stepX, stepY, _), _, _, _, _) =>
      newBound = Some(Bound(0, 0, (row - 1) * stepX, (col - 1) * stepY))
  }

  private def adjustScene(bound : Bound, scene : Scene) : Unit = {
    mainContainer.setPosition(0, 0)
    val Bound(minX, minY, maxX, maxY) = bound
    val (width, height) = (maxX - minX, maxY - minY)
    val (halfWidth, halfHeight) = (width / 2, height / 2)
    val (centerX, centerY) = (halfWidth + minX, halfHeight + minY)
    val (gameCenterX, gameCenterY) = (game.canvas.width / 2.0, game.canvas.height / 2.0)
    scene.cameras.main.scrollX = - (gameCenterX - centerX)
    scene.cameras.main.scrollY = - (gameCenterY - centerY)
    val zoomFactorHeight = (game.canvas.height / height)
    val zoomFactorWidth = (game.canvas.width / width)
    val zoomFactor = if(zoomFactorWidth < zoomFactorHeight) zoomFactorWidth else zoomFactorHeight
    val slack = if (zoomFactor > 1) cameraSlack else noSlack
    scene.cameras.main.zoom = zoomFactor + slack
  }

  private def onSameGraph(graph : Graph, scene : Phaser.Scene) : Unit = ()

  private def onNewGraph(graph : Graph, scene : Phaser.Scene) : Unit = {
    //TODO improve performance (e.g. via caching)
    vertexContainer.removeAll(true)
    nodeContainer.removeAll(true)
    labelContainer.removeAll(true)

    if(settings.neighbourhoodEnabled) { renderVertex(graph, scene) }

    popup.selectedId.foreach(id => popup.refresh(graph(id)))

    val nodes = graph.nodes.map(node => {
      val circle = scene.add.circle(node.position.x, node.position.y, size, nodeColor)
      circle.id = node.id
      node -> circle
    })
    val gameobjectNodes = nodes.map { case (_, circle) => circle }
    gameobjectNodes.foreach(nodeContainer.add(_))
    import js.JSConverters._
    scene.physics.add.staticGroup(gameobjectNodes.toJSArray)
    if(settings.anyLabelEnabled) { renderLabel(nodes, scene, graph) }
    model = model.copy(_2 = false)
  }

  private def renderVertex(graph : Graph, scene : Scene) : Unit = {
    graph.vertices.map(vertex =>  (graph(vertex.from), graph(vertex.to)))
      .map { case (from, to) => scene.add.line(x1 = from.position.x, y1 = from.position.y, x2 = to.position.x, y2 = to.position.y, strokeColor = lineColor ) }
      .map { _.setOrigin(0)}
      .foreach(vertexContainer.add(_))
  }

  private def renderLabel[E <: GameobjectNode](nodes : Set[(Node, E)], scene : Scene, world : Graph) : Unit = {
    def renderNodeLabels(node : E, labels : List[(String, Any)]) : Seq[GameObject] = {
      type FoldType = (Seq[(String, Any)], Seq[GameObject])

      labelRenders.foldLeft[FoldType](labels, Seq.empty){
        case ((labelsRemains, gameObjects), render) =>
          val rendered = render.graphicalRepresentation(node, labelsRemains, world, scene)
          val renderedLabel = rendered.flatMap { case (_, labels) => labels }
          val renderedGameobject = rendered.map { case (gameobj,_) => gameobj }
          val labelsRemainsUpdated = labelsRemains.filterNot { case (name, value) => renderedLabel.contains(name) }
          (labelsRemainsUpdated, gameObjects ++ renderedGameobject)
      }._2
    }

    nodes.map { case (node, gameobject) => gameobject -> node.labels }
      .map { case (node, labels) => node -> labels.filter(label => settings.sensorEnabled(label._1)) }
      .map { case (node, labels) => node -> labels.toList }
      .map { case (node, labels) => node -> (if (settings.idEnabled) (("id" -> node.id) :: labels) else labels) }
      .flatMap { case (node, labels) => renderNodeLabels(node, labels)}
      .foreach(labelContainer.add(_))
  }
}

object PhaserGraphSection {

  /**
    * a set of event that could be received by this sectio
    */
  sealed trait VisualizationEvent

  /**
    * repaint the graph even if it is not changed.
    */
  object ForceRepaint

  //TODO here we need to use coordinate mapping to do the right job
  /**
    * bound of a new configuration
   */
  case class Bound(minX : Double, minY : Double, maxX : Double, maxY : Double)
}

