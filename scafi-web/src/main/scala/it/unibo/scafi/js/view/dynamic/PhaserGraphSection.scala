package it.unibo.scafi.js.view.dynamic
import it.unibo.scafi.core.Core
import it.unibo.scafi.js.controller.CommandInterpreter
import it.unibo.scafi.js.controller.local.SimulationCommand
import it.unibo.scafi.js.controller.local.SimulationCommand.{Move, ToggleSensor}
import it.unibo.scafi.js.facade.phaser.namespaces.EventsNamespace.{Handler1, Handler4}
import it.unibo.scafi.js.facade.phaser.namespaces.InputNamespace.Pointer
import it.unibo.scafi.js.facade.phaser.namespaces.ScaleNamespace.ScaleModes
import it.unibo.scafi.js.facade.phaser.types.core._
import it.unibo.scafi.js.facade.phaser.types.physics.arcade.ArcadeWorldConfig
import it.unibo.scafi.js.facade.phaser.{Phaser, types}
import it.unibo.scafi.js.model.Graph
import it.unibo.scafi.js.{Debug, JSNumber}
import org.scalajs.dom.raw.HTMLElement

import scala.scalajs.js
//TODO manage resize
class PhaserGraphSection(paneSection : HTMLElement, commandInterpreter : CommandInterpreter[_, _, SimulationCommand, SimulationCommand.Result]) extends (Graph => Unit) {
  import Phaser.GameObjects.Components._
  import Phaser._
  private var model : (Option[Graph], Boolean) = (Option.empty[Graph], false)
  private val size = 5 //TODO put in configuration
  private val nodeColor : Int = 0xff00ff //TODO put in configuration
  private val selectionColor : Int = 0xff0000 //TODO put in configuration
  private val lineColor : Int = 0x0000ff //TODO put in configuration
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
  private lazy val game = new Phaser.Game(config)
  Debug("config", game)
  protected var mainContainer : GameObjects.Container = _
  protected var vertexContainer : GameObjects.Container = _
  protected var nodeContainer : GameObjects.Container = _
  protected var labelContainer : GameObjects.Container = _
  protected var rectangleSelection : GameObjects.Rectangle = _
  protected var selectionContainer : GameObjects.Container = _

  private lazy val sceneHandler : types.scenes.CreateSceneFromObjectConfig =  types.scenes.callbacks(
    preload = (scene) => {
      //TODO put in configuration
      scene.load.bitmapFont("font", "http://labs.phaser.io/assets/fonts/bitmap/atari-smooth.png", "http://labs.phaser.io/assets/fonts/bitmap/atari-smooth.xml")
    },
    create = (scene, _) => {
      //game.input.mouse.foreach(mouse => mouse.capture = false)
      //game.input.keyboard.foreach(keyboard => keyboard.preventDefault = false)
      val mainCamera = scene.cameras.main
      mainCamera.zoom = 1
      vertexContainer = scene.add.container(0, 0)
      labelContainer = scene.add.container(0, 0)
      nodeContainer = scene.add.container(0, 0)
      selectionContainer = scene.add.container(0, 0)
      mainContainer = scene.add.container(0, 0, js.Array(vertexContainer, nodeContainer, labelContainer, selectionContainer))
      rectangleSelection = scene.add.rectangle(0, 0, 0, 0, fillColor = 0xFFFFFF, fillAlpha = 0.5)
      mainContainer.setSize(Int.MaxValue, Int.MaxValue)
      createInteractionFsm(scene)
      scene.input.on("wheel", (self : js.Any, pointer : js.Any, _ : js.Any, dx : JSNumber, dy : JSNumber, dz : JSNumber) => {
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
      .map { _.setOrigin[GameObjects.Line](0)}
      .foreach(vertexContainer.add(_))

    val nodes = graph.nodes.map(node => {
      val circle = scene.add.circle(node.position.x, node.position.y, size, nodeColor)
      circle.setData[GameObjects.Arc]("id", node.id)
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
    case (_, other: Double) => "" + other % 0.01
    case (_, e) => e.toString
  }

  private trait State
  private case object MoveWorld extends State
  private case object MoveSelection extends State
  private case object OnSelection extends State
  private case object Idle extends State
  private var state : State = Idle

  private def createInteractionFsm(scene : Scene) : Unit = {
    mainContainer.setInteractive()
    scene.input.setDraggable(mainContainer)
    //fsm actions
    onPointerDown(scene)
    onPointerUp(scene)
    onMainContainerDrag(scene)
    onMainContainerDrag(scene)
    controlKeyEvents(scene)
    altKeyEvents(scene)
    onToggle(scene)
    scene.input.on("gameout", (_ : Any) => {
      state = Idle
      this.game.canvas.style.cursor = "auto"
    })
  }

  private def onPointerDown(scene : Scene) : Unit = {
    mainContainer.on("pointerdown", (_ : Any, pointer : Input.Pointer) => state match {
      case Idle =>
        resetSelection()
        rectangleSelection.setPosition(pointer.worldX, pointer.worldY)
        state = OnSelection
      case _ =>
    })
  }

  private def onPointerUp(scene  : Scene) : Unit = {
    scene.input.on("pointerup", (self : Any, pointer : Input.Pointer) => state match {
      case OnSelection => state = Idle
        val (overlapX, overlapY) = (rectangleSelection.x - mainContainer.x, rectangleSelection.y - mainContainer.y)
        val (overlapWidth, overlapHeight) = (rectangleSelection.width, rectangleSelection.height)
        val elements = scene.physics.overlapRect(overlapX, overlapY, overlapWidth, overlapHeight, includeStatic = true)
        elements.map(body => {
          val selected = scene.add.circle(body.center.x, body.center.y, size, selectionColor)
          selected.setData[GameObjects.Arc]("id", body.gameObject.getData("id"))
        }).foreach(selectionContainer.add(_))
      case _ =>
    })
  }

  private def onMainContainerDrag(scene: Phaser.Scene) : Unit = {
    val dragFunction: Handler4[Transform] = (obj : Transform, pointer : Pointer, dragX : JSNumber, dragY : JSNumber, _ : Any) => state match {
      case MoveWorld => obj.setPosition(dragX, dragY)
      case OnSelection =>
        rectangleSelection.setSize[GameObjects.Rectangle](pointer.worldX - rectangleSelection.x, pointer.worldY - rectangleSelection.y)
      case _ =>
    }
    mainContainer.on("drag", dragFunction)
  }

  private def controlKeyEvents(scene : Phaser.Scene) : Unit = {
    val controlKey = scene.input.keyboard.get.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL)
    val controlUpHandler : Handler1[Scene] = (scene, _ : Any) => state match {
      case MoveWorld => state = Idle
        this.game.canvas.style.cursor = "auto"
      case _ =>
    }

    val controlDownHandler : Handler1[Scene] = (scene, _ : Any) => state match {
      case Idle => this.game.canvas.style.cursor = "grab"
        state = MoveWorld
        resetSelection()
      case _ =>
    }
    controlKey.on("down", controlDownHandler)
    controlKey.on("up", controlUpHandler)
  }

  private def altKeyEvents(scene : Phaser.Scene) : Unit = {
    val dragFunction : Handler4[Transform] = (obj : Transform, pointer : Pointer, dragX : JSNumber, dragY : JSNumber, _ : Any) => state match {
      case MoveSelection =>
        selectionContainer.x += dragX - obj.x
        selectionContainer.y += dragY - obj.y
        obj.setPosition(dragX, dragY)
      case _ =>
    }

    val altKey = scene.input.keyboard.get.addKey(Phaser.Input.Keyboard.KeyCodes.ALT)
    val altUpHandler : Handler1[Scene] = (obj, _ : Any) => state match {
      case MoveSelection => state = Idle
        this.game.canvas.style.cursor = "auto"
        val positionChangedMap = selectionContainer.list[GameObjects.Arc]
          .map(node => (node.getData("id").toString, (node.x + selectionContainer.x, node.y + selectionContainer.y)))
          .toMap
        commandInterpreter.execute(Move(positionChangedMap))
        resetSelection()
        rectangleSelection.disableInteractive()
      case _ =>
    }

    val altDownHandler : Handler1[Scene] = (obj, _ : Any) => state match {
      case Idle => this.game.canvas.style.cursor = "all-scroll"
        state = MoveSelection
        if(rectangleSelection.width != 0 && rectangleSelection.height != 0) {
          rectangleSelection.destroy(true)
          val (x, y, width, height) = (rectangleSelection.x, rectangleSelection.y, rectangleSelection.width, rectangleSelection.height)
          rectangleSelection = scene.add.rectangle(x, y, width, height, fillColor = 0xFFFFFF, fillAlpha = 0.5)
            .setOrigin(0)
          rectangleSelection.setInteractive()
          scene.input.setDraggable(rectangleSelection)
          rectangleSelection.on("drag", dragFunction)
        }
      case _ =>
    }
    altKey.on("down", altDownHandler)
    altKey.on("up", altUpHandler)
  }

  private def onToggle(scene : Scene): Unit = {
    def onClickDown(sensor : String) : Handler1[Scene] = (obj, event : js.Object) => {
      val ids = selectionContainer.list[GameObjects.Arc]
        .map(node => (node.getData("id").toString))
        .toSet
      commandInterpreter.execute(ToggleSensor(sensor, ids))
    }
    val oneNumber = scene.input.keyboard.get.addKey(Phaser.Input.Keyboard.KeyCodes.ONE)
    val twoNumber = scene.input.keyboard.get.addKey(Phaser.Input.Keyboard.KeyCodes.TWO)
    oneNumber.on("down", onClickDown("source"))
    twoNumber.on("down", onClickDown("obstacle"))
  }

  private def resetSelection() : Unit = {
    rectangleSelection.setSize[GameObjects.Rectangle](0, 0)
    selectionContainer.removeAll()
    selectionContainer.setPosition(0, 0)
  }
}