package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.controller.CommandInterpreter
import it.unibo.scafi.js.controller.local.{SimulationCommand, SupportConfiguration}
import it.unibo.scafi.js.facade.phaser.Implicits._
import it.unibo.scafi.js.facade.phaser.Phaser.Input.Events._
import it.unibo.scafi.js.facade.phaser.Phaser.{GameObjects, Scene}
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.{Container, GameObject, Rectangle}
import it.unibo.scafi.js.facade.phaser.namespaces.InputNamespace.Pointer
import it.unibo.scafi.js.facade.phaser.namespaces.gameobjects.ComponentsNamespace.Transform
import it.unibo.scafi.js.utils.{Debug, Execution, JSNumber}
import it.unibo.scafi.js.view.dynamic.EventBus
import it.unibo.scafi.js.view.dynamic.graph.Interaction.State
import monix.reactive.Observable
import monix.reactive.subjects.PublishSubject
import org.scalajs.dom.ext.Color
import NodeRepresentation._
import it.unibo.scafi.js.controller.local.SimulationCommand.Move

trait Interaction {
  def state : State
  def selection : Option[Seq[String]]
  def changeTo(s : State) : Unit
  def stateSource : Observable[State]
  def selectionSource : Observable[Seq[String]]
  def commandInterpreter: CommandInterpreter[_, _, SimulationCommand, SimulationCommand.Result]
}

object Interaction {
  trait State
  case object Pan extends State
  case object Selection extends State
  class PhaserInteraction(val commandInterpreter: CommandInterpreter[_, _, SimulationCommand, SimulationCommand.Result])
    extends Interaction {
    implicit val execution = Execution.timeoutBasedScheduler
    private var scene : Scene = _
    private var mainContainer : Container = _
    private var popup : NodeDescriptionPopup = _
    private val stateSubject = PublishSubject[State]
    private val selectionSubject = PublishSubject[Seq[String]]
    private var rectangleSelection : Rectangle = _
    private var selectionContainer : Container = _
    private val rectangleAlpha = 0.5
    private var positionBeforeDrag = (0.0, 0.0)
    private val selectionColor = Color.Red
    var state: State = Pan
    var selection: Option[Seq[String]] = None

    def onPhaserLoaded(scene : Scene, popup: NodeDescriptionPopup, container: Container) : Unit = {
      this.scene = scene
      this.popup = popup
      this.mainContainer = container
      EventBus.listen { case config : SupportConfiguration => resetSelection() } //fix selection issue
      initRectangle()
      onDragStart()
      onDrag()
      onDragEnd()
    }

    override def changeTo(s: State): Unit = {
      //change cursor?? Thinking about..
      stateSubject.onNext(s)
      resetSelection()
      state = s
    }

    override def stateSource: Observable[State] = stateSubject.publish

    override def selectionSource: Observable[Seq[String]] = selectionSubject.publish

    def initRectangle() : Unit = {
      rectangleSelection = scene.add.rectangle(0, 0, 0, 0, fillColor = Color.White, fillAlpha = rectangleAlpha).setOrigin(0)
      selectionContainer = scene.add.container(0, 0)
      mainContainer.add(selectionContainer)
      mainContainer.setInteractive()
      scene.input.setDraggable(mainContainer)
    }

    def onDragStart() : Unit = {
      mainContainer.on(DRAG_START, (obj : Any, p : Pointer) => (state, selection) match {
        case (Selection, None) => rectangleSelection.setPosition(p.worldX, p.worldY)
        case (Selection, Some(elements)) if (rectangleSelection.getBounds().contains(p.worldX, p.worldY)) =>
          positionBeforeDrag = selectionWorldCoordinate
        case (Selection, Some(elements)) => resetSelection()
         rectangleSelection.setPosition(p.worldX, p.worldY)
        case (Pan, _) =>
      })
    }

    def onDragEnd() : Unit = {
      mainContainer.on(DRAG_END, (obj : Any) => (state, selection) match {
        case (Selection, None) => evaluateSelection()
        case (Selection, _) => val positionChangedMap = selectionContainer.list[GameObjects.Arc]
            .map(node => (node.id, (node.x + selectionContainer.x, node.y + selectionContainer.y)))
            .toMap
          commandInterpreter.execute(Move(positionChangedMap))
        case (Pan, _) =>
      })
    }

    def onDrag() : Unit = {
      mainContainer.on(DRAG, (obj : Transform, p : Pointer,  dx : JSNumber, dy : JSNumber, _ : Any) => (state, selection) match {
        case (Selection, None) => rectangleSelection.setSize(p.worldX - rectangleSelection.x, p.worldY - rectangleSelection.y)
        case (Selection, Some(elements)) =>
          selectionContainer.x += (dx + positionBeforeDrag._1) - rectangleSelection.x
          selectionContainer.y += (dy + positionBeforeDrag._2) - rectangleSelection.y
          rectangleSelection.setPosition(positionBeforeDrag._1 + dx,positionBeforeDrag._2 + dy)
        case (Pan, _) => obj.setPosition(dx, dy)
        case _ =>
      })
    }

    def evaluateSelection() : Unit = {
      val (overlapX, overlapY) = selectionWorldCoordinate
      val (overlapWidth, overlapHeight) = (rectangleSelection.getBounds().width,  rectangleSelection.getBounds().height)
      val elements = scene.physics.overlapRect(overlapX, overlapY, overlapWidth, overlapHeight, includeStatic = true)
      this.selection = Some(elements.map(_.gameObject.id).toSeq)
      this.selectionSubject.onNext(this.selection.get)
      elements.map(body => {
        val selected = scene.add.circle(body.center.x, body.center.y, body.halfWidth, selectionColor)
        selected.id = body.gameObject.id
      }).foreach(selectionContainer.add(_))

      if(overlapWidth == 0 && overlapHeight == 0 && elements.nonEmpty) {
        popup.focusOn(selectionContainer.list[Transform with GameObject].head)
      } //todo it is here? or in another place?
    }

    private def selectionWorldCoordinate : (Double, Double) = {
      val bounds = rectangleSelection.getBounds()
      (bounds.x - mainContainer.x, bounds.y - mainContainer.y)
    }
    private def resetSelection() : Unit = {
      rectangleSelection.setSize(0, 0)
      selectionContainer.removeAll()
      selectionContainer.setPosition(0, 0)
      rectangleSelection.setInteractive()
      selectionSubject.onNext(Seq.empty)
      this.selection = None
    }
  }
}
