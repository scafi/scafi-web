package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.controller.CommandInterpreter
import it.unibo.scafi.js.controller.local.SimulationCommand.{Move, ToggleSensor}
import it.unibo.scafi.js.controller.local.{SimulationCommand, SupportConfiguration}
import it.unibo.scafi.js.facade.phaser.Implicits._
import it.unibo.scafi.js.facade.phaser.Phaser
import it.unibo.scafi.js.facade.phaser.Phaser.Input.Events._
import it.unibo.scafi.js.facade.phaser.Phaser.Input.Keyboard.Events._
import it.unibo.scafi.js.facade.phaser.Phaser.{GameObjects, Input, Scene}
import it.unibo.scafi.js.facade.phaser.namespaces.EventsNamespace.{Handler1, Handler4}
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.{Container, GameObject, Rectangle}
import it.unibo.scafi.js.facade.phaser.namespaces.InputNamespace.{InputPlugin, Pointer}
import it.unibo.scafi.js.facade.phaser.namespaces.gameobjects.ComponentsNamespace.Transform
import it.unibo.scafi.js.facade.phaser.namespaces.input.KeyboardNamespace.{Key, KeyCodes}
import it.unibo.scafi.js.utils._
import it.unibo.scafi.js.view.dynamic.EventBus
import it.unibo.scafi.js.view.static.Cursor
import it.unibo.scafi.js.view.static.Cursor.Implicits._
import org.scalajs.dom.ext.Color
import NodeRepresentation._
import NodeRepresentation._
import scala.scalajs.js

class PhaserInteraction(private val commandInterpreter: CommandInterpreter[_, _, SimulationCommand, SimulationCommand.Result])
  extends ((Scene, NodeDescriptionPopup, Container) => Unit) {
  import KeyCodes._
  import InteractionState._
  private var state : InteractionState = Idle
  private var rectangleSelection : Rectangle = _
  private var selectionContainer : Container = _
  private val rectangleAlpha = 0.5
  private val selectionColor = Color.Red
  private var sensors : Seq[String] = Seq()
  private val keys = List(ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE)
  private var scene : Nullable[Scene] = _
  private var mainContainer : Nullable[Container] = _
  private var popup : Nullable[NodeDescriptionPopup] = _
  EventBus.listen {
    case SupportConfiguration(_, _, deviceShape, _, _) => sensors = deviceShape.sensors
      .filter {
        case (_, _ : Boolean) => true
        case _ => false
      }
      .map { case (name, _) => name }.toSeq
      onToggle()
  }

  override def apply(scene: Scene, popup: NodeDescriptionPopup, mainContainer : Container): Unit = {
    this.scene = scene
    this.mainContainer = mainContainer
    this.popup = popup
    initInteractionObjects()
    //fsm actions
    onPointerDown()
    onPointerUp()
    onMainContainerDrag()
    onMainContainerDrag()
    controlKeyEvents()
    altKeyEvents()
    onToggle()
    onGameInOut()
  }

  private def initInteractionObjects() = (scene.toOption, mainContainer.toOption) match {
    case (Some(scene), Some(mainContainer)) =>
      rectangleSelection = scene.add.rectangle(0, 0, 0, 0, fillColor = Color.White, fillAlpha = rectangleAlpha).setOrigin(0)
      selectionContainer = scene.add.container(0, 0)
      mainContainer.add(selectionContainer)
      mainContainer.setInteractive()
      scene.input.setDraggable(mainContainer)
    case _ =>
  }

  private def onPointerDown() : Unit = {
    mainContainer.foreach {
      _.on(POINTER_DOWN, (_ : Any, pointer : Input.Pointer) => state match {
        case Idle => resetSelection()
          rectangleSelection.setPosition(pointer.worldX, pointer.worldY)
          state = OnSelection
        case _ =>
      })
    }
  }

  private def onPointerUp() : Unit = (scene.toOption, mainContainer.toOption) match {
    case (Some(scene), Some(mainContainer)) =>
      scene.input.on(POINTER_UP, (self : Any, pointer : Input.Pointer) => state match {
      case OnSelection => state = Idle
        val bounds = rectangleSelection.getBounds()
        val (overlapX, overlapY) = (bounds.x - mainContainer.x, bounds.y - mainContainer.y)
        val (overlapWidth, overlapHeight) = (bounds.width, bounds.height)
        val elements = scene.physics.overlapRect(overlapX, overlapY, overlapWidth, overlapHeight, includeStatic = true)
        elements.map(body => {
          val selected = scene.add.circle(body.center.x, body.center.y, body.halfWidth, selectionColor)
          selected.id = body.gameObject.id
        }).foreach(selectionContainer.add(_))

        if(overlapWidth == 0 && overlapHeight == 0 && elements.nonEmpty) {
          popup.foreach(_.focusOn(selectionContainer.list[Transform with GameObject].head))
        }
      case _ =>
    })
    case _ =>
  }

  private def onMainContainerDrag() : Unit = (mainContainer.toOption, scene.toOption) match {
    case (Some(mainContainer), Some(scene)) =>
      mainContainer.on(DRAG_START, (_ : Any, pointer : Pointer) => state match {
        case MoveWorld => scene.game.canvas.style.cursor = Cursor.Grabbing
        case _ =>
      })
      mainContainer.on(DRAG, dragMoveworldFunction)
      mainContainer.on(DRAG_END, (_ : Any, pointer : Pointer) => state match {
        case MoveWorld => scene.game.canvas.style.cursor = Cursor.Grab
        case _ =>
      })
    case _ =>
  }

  private val dragMoveworldFunction: Handler4[Transform] = (obj : Transform, pointer : Pointer, dragX : JSNumber, dragY : JSNumber, _ : Any) => state match {
    case MoveWorld => obj.setPosition(dragX, dragY)
    case OnSelection =>
      rectangleSelection.setSize(pointer.worldX - rectangleSelection.x, pointer.worldY - rectangleSelection.y)
    case _ =>
  }

  private def controlKeyEvents() : Unit = scene.toOption match {
    case Some(scene) =>
      val controlKey = scene.input.keyboard.get.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL)
      controlKey.on(DOWN, controlDownHandler)
      controlKey.on(UP, controlUpHandler)
    case _ =>
  }

  private val controlUpHandler : Handler1[Key] = (key, _ : Any) => state match {
    case MoveWorld => state = Idle
      key.plugin.game.canvas.style.cursor = Cursor.Auto
    case _ =>
  }

  private val controlDownHandler : Handler1[Key] = (key, _ : Any) => state match {
    case Idle => key.plugin.game.canvas.style.cursor = Cursor.Grab
      state = MoveWorld
      resetSelection()
    case _ =>
  }

  private def altKeyEvents() : Unit = {
    val altKey = scene.map(_.input.keyboard.get.addKey(Phaser.Input.Keyboard.KeyCodes.ALT))
    altKey.foreach(key => {
      key.on(DOWN, altDownHandler)
      key.on(UP, altUpHandler)
    })
  }

  private val altUpHandler : Handler1[Key] = (key, _ : Any) => state match {
    case MoveSelection => state = Idle
      key.plugin.game.canvas.style.cursor = Cursor.Auto
      val positionChangedMap = selectionContainer.list[GameObjects.Arc]
        .map(node => (node.id, (node.x + selectionContainer.x, node.y + selectionContainer.y)))
        .toMap
      commandInterpreter.execute(Move(positionChangedMap))
      resetSelection()
      rectangleSelection.disableInteractive()
    case _ =>
  }

  private val altDownHandler : Handler1[Key] = (key, _ : Any) => state match {
    case Idle =>
      val scene = key.plugin.scene
      key.plugin.game.canvas.style.cursor = Cursor.AllScroll
      state = MoveSelection
      if(rectangleSelection.width != 0 && rectangleSelection.height != 0) {
        rectangleSelection.destroy(true)
        val (x, y, width, height) = (rectangleSelection.x, rectangleSelection.y, rectangleSelection.width, rectangleSelection.height)
        rectangleSelection = scene.add.rectangle(x, y, width, height, fillColor = Color.White, fillAlpha = rectangleAlpha).setOrigin(0)
        rectangleSelection.setInteractive()
        scene.input.setDraggable(rectangleSelection)
        rectangleSelection.on(DRAG, dragAltFunction)
      }
    case _ =>
  }

  private val dragAltFunction : Handler4[Transform] = (obj : Transform, _ : Pointer, dragX : JSNumber, dragY : JSNumber, _ : Any) => state match {
    case MoveSelection => selectionContainer.x += dragX - obj.x
      selectionContainer.y += dragY - obj.y
      obj.setPosition(dragX, dragY)
    case _ =>
  }

  private def onToggle(): Unit = scene.toOption match {
    case Some(scene) =>
      keys.foreach(scene.input.keyboard.get.removeKey(_, destroy = true))
      keys.zip(sensors).
        map { case (key, name) => name -> scene.input.keyboard.get.addKey(key) }
        .foreach { case (sensor, key) => key.on(DOWN, onClickDown(sensor)) }
      resetSelection() //fix selection problems
    case _ =>
  }

  private def onClickDown(sensor : String) : Handler1[Scene] = (obj, event : js.Object) => {
    val ids = selectionContainer.list[GameObjects.Arc]
      .map(node => (node.id))
      .toSet
    commandInterpreter.execute(ToggleSensor(sensor, ids))
  }

  private def onGameInOut() : Unit = scene.toOption match {
    case Some(scene) =>
      scene.input.on(GAME_OUT, (plugin : InputPlugin) => {
        state = Idle
        plugin.scene.game.canvas.style.cursor = Cursor.Auto
      })
      scene.input.on(GAME_OVER, (plugin : InputPlugin) =>  plugin.scene.game.canvas.parentElement.focus())
    case _ =>
  }
  private def resetSelection() : Unit = {
    rectangleSelection.setSize(0, 0)
    selectionContainer.removeAll()
    selectionContainer.setPosition(0, 0)
  }
}