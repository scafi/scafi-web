package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.utils._
import it.unibo.scafi.js.controller.CommandInterpreter
import it.unibo.scafi.js.controller.local.SimulationCommand
import it.unibo.scafi.js.controller.local.SimulationCommand.{Move, ToggleSensor}
import it.unibo.scafi.js.facade.phaser.Implicits._
import it.unibo.scafi.js.facade.phaser.Phaser
import it.unibo.scafi.js.facade.phaser.Phaser.Input.Events._
import it.unibo.scafi.js.facade.phaser.Phaser.Input.Keyboard.Events._
import it.unibo.scafi.js.facade.phaser.Phaser.{Game, GameObjects, Input, Scene}
import it.unibo.scafi.js.facade.phaser.namespaces.EventsNamespace.{Handler1, Handler4}
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.{Container, Rectangle}
import it.unibo.scafi.js.facade.phaser.namespaces.InputNamespace.Pointer
import it.unibo.scafi.js.facade.phaser.namespaces.gameobjects.ComponentsNamespace.Transform
import it.unibo.scafi.js.view.dynamic.PhaserInteraction._
import it.unibo.scafi.js.view.static.Cursor
import it.unibo.scafi.js.view.static.Cursor.Implicits._
import org.scalajs.dom.ext.Color

import scala.scalajs.js

class PhaserInteraction(private val commandInterpreter: CommandInterpreter[_, _, SimulationCommand, SimulationCommand.Result])
  extends ((Game, Scene, Container) => Unit) {
  private var state : State = Idle
  private var rectangleSelection : Rectangle = _
  private var selectionContainer : Container = _
  private val rectangleAlpha = 0.5
  private val selectionColor = Color.Red
  override def apply(game: Game, scene: Scene, mainContainer : Container): Unit = {
    initInteractionObjects(scene, mainContainer)
    //fsm actions
    onPointerDown(scene, mainContainer)
    onPointerUp(scene, mainContainer)
    onMainContainerDrag(scene, mainContainer)
    onMainContainerDrag(scene, mainContainer)
    controlKeyEvents(scene, game)
    altKeyEvents(scene, game)
    onToggle(scene)
    onGameInOut(scene, game)
  }

  private def initInteractionObjects(scene : Scene, mainContainer : Container) {
    rectangleSelection = scene.add.rectangle(0, 0, 0, 0, fillColor = Color.White, fillAlpha = rectangleAlpha).setOrigin(0)
    selectionContainer = scene.add.container(0, 0)
    mainContainer.add(selectionContainer)
    mainContainer.setInteractive()
    scene.input.setDraggable(mainContainer)
  }

  private def onPointerDown(scene : Scene, mainContainer : Container) : Unit = {
    mainContainer.on(POINTER_DOWN, (_ : Any, pointer : Input.Pointer) => state match {
      case Idle => resetSelection()
        rectangleSelection.setPosition(pointer.worldX, pointer.worldY)
        state = OnSelection
      case _ =>
    })
  }

  private def onPointerUp(scene  : Scene, mainContainer : Container) : Unit = {
    scene.input.on(POINTER_UP, (self : Any, pointer : Input.Pointer) => state match {
      case OnSelection => state = Idle
        val (overlapX, overlapY) = (rectangleSelection.x - mainContainer.x, rectangleSelection.y - mainContainer.y)
        val (overlapWidth, overlapHeight) = (rectangleSelection.width, rectangleSelection.height)
        val elements = scene.physics.overlapRect(overlapX, overlapY, overlapWidth, overlapHeight, includeStatic = true)
        elements.map(body => {
          val selected = scene.add.circle(body.center.x, body.center.y, body.halfWidth, selectionColor)
          selected.setData("id", body.gameObject.getData("id"))
        }).foreach(selectionContainer.add(_))
      case _ =>
    })
  }

  private def onMainContainerDrag(scene: Phaser.Scene, mainContainer : Container) : Unit = {
    val dragFunction: Handler4[Transform] = (obj : Transform, pointer : Pointer, dragX : JSNumber, dragY : JSNumber, _ : Any) => state match {
      case MoveWorld => obj.setPosition(dragX, dragY)
      case OnSelection =>
        rectangleSelection.setSize(pointer.worldX - rectangleSelection.x, pointer.worldY - rectangleSelection.y)
      case _ =>
    }
    mainContainer.on(DRAG_START, (_ : Any, pointer : Pointer) => state match {
      case MoveWorld => scene.game.canvas.style.cursor = Cursor.Grabbing
      case _ =>
    })
    mainContainer.on(DRAG, dragFunction)
    mainContainer.on(DRAG_END, (_ : Any, pointer : Pointer) => state match {
      case MoveWorld => scene.game.canvas.style.cursor = Cursor.Grab
      case _ =>
    })
  }

  private def controlKeyEvents(scene : Phaser.Scene, game : Game) : Unit = {
    val controlKey = scene.input.keyboard.get.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL)
    val controlUpHandler : Handler1[Scene] = (scene, _ : Any) => state match {
      case MoveWorld => state = Idle
        game.canvas.style.cursor = Cursor.Auto
      case _ =>
    }

    val controlDownHandler : Handler1[Scene] = (scene, _ : Any) => state match {
      case Idle => game.canvas.style.cursor = Cursor.Grab
        state = MoveWorld
        resetSelection()
      case _ =>
    }
    controlKey.on(DOWN, controlDownHandler)
    controlKey.on(UP, controlUpHandler)
  }

  private def altKeyEvents(scene : Phaser.Scene, game : Game) : Unit = {
    val dragFunction : Handler4[Transform] = (obj : Transform, pointer : Pointer, dragX : JSNumber, dragY : JSNumber, _ : Any) => state match {
      case MoveSelection => selectionContainer.x += dragX - obj.x
        selectionContainer.y += dragY - obj.y
        obj.setPosition(dragX, dragY)
      case _ =>
    }

    val altKey = scene.input.keyboard.get.addKey(Phaser.Input.Keyboard.KeyCodes.ALT)
    val altUpHandler : Handler1[Scene] = (obj, _ : Any) => state match {
      case MoveSelection => state = Idle
        game.canvas.style.cursor = Cursor.Auto
        val positionChangedMap = selectionContainer.list[GameObjects.Arc]
          .map(node => (node.getData("id").toString, (node.x + selectionContainer.x, node.y + selectionContainer.y)))
          .toMap
        commandInterpreter.execute(Move(positionChangedMap))
        resetSelection()
        rectangleSelection.disableInteractive()
      case _ =>
    }

    val altDownHandler : Handler1[Scene] = (obj, _ : Any) => state match {
      case Idle => game.canvas.style.cursor = Cursor.AllScroll
        state = MoveSelection
        if(rectangleSelection.width != 0 && rectangleSelection.height != 0) {
          rectangleSelection.destroy(true)
          val (x, y, width, height) = (rectangleSelection.x, rectangleSelection.y, rectangleSelection.width, rectangleSelection.height)
          rectangleSelection = scene.add.rectangle(x, y, width, height, fillColor = Color.White, fillAlpha = rectangleAlpha).setOrigin(0)
          rectangleSelection.setInteractive()
          scene.input.setDraggable(rectangleSelection)
          rectangleSelection.on(DRAG, dragFunction)
        }
      case _ =>
    }
    altKey.on(DOWN, altDownHandler)
    altKey.on(UP, altUpHandler)
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
    oneNumber.on(DOWN, onClickDown("source"))
    twoNumber.on(DOWN, onClickDown("obstacle"))
  }

  private def onGameInOut(scene : Scene, game : Game) : Unit = {
    scene.input.on(GAME_OUT, (_ : Any) => {
      state = Idle
      game.canvas.style.cursor = Cursor.Auto
    })
    scene.input.on(GAME_OVER, (_ : Any) => game.canvas.parentElement.focus())
  }
  private def resetSelection() : Unit = {
    rectangleSelection.setSize(0, 0)
    selectionContainer.removeAll()
    selectionContainer.setPosition(0, 0)
  }
}

object PhaserInteraction {
  private trait State
  private case object MoveWorld extends State
  private case object MoveSelection extends State
  private case object OnSelection extends State
  private case object Idle extends State
}