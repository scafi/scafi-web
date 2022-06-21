package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.controller.CommandInterpreter
import it.unibo.scafi.js.controller.local.{SimulationCommand, SupportConfiguration}
import it.unibo.scafi.js.controller.local.SimulationCommand.Move
import it.unibo.scafi.js.facade.phaser.Implicits._
import it.unibo.scafi.js.facade.phaser.Phaser.{GameObjects, Scene}
import it.unibo.scafi.js.facade.phaser.Phaser.Input.Events._
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.{Container, GameObject, Rectangle}
import it.unibo.scafi.js.facade.phaser.namespaces.InputNamespace.Pointer
import it.unibo.scafi.js.facade.phaser.namespaces.gameobjects.ComponentsNamespace.Transform
import it.unibo.scafi.js.utils.{Execution, GlobalStore, JSNumber}
import it.unibo.scafi.js.view.dynamic.PageBus
import it.unibo.scafi.js.view.dynamic.graph.Interaction.State
import it.unibo.scafi.js.view.dynamic.graph.NodeRepresentation._
import monix.execution.Scheduler
import monix.reactive.Observable
import monix.reactive.subjects.PublishSubject
import org.scalajs.dom.ext.Color

import scala.scalajs.js

/** The trait models an abstraction over the possible interactions with the view. */
trait Interaction {

  /** @return The current cursor drag handling mode. */
  def state: State

  /** @return The current selection of nodes, if any. */
  def selection: Option[Seq[String]]

  /** Change current state of the cursor drag handling mode.
    *
    * @param s
    *   the new mode
    */
  def changeTo(s: State): Unit

  /** @return an observable source of the internal [[state]]. */
  def stateSource: Observable[State]

  /** @return an observable source of the current [[selection]]. */
  def selectionSource: Observable[Seq[String]]

  /** @return an interpreter that allows to handle the interaction commands. */
  def commandInterpreter: CommandInterpreter[_, _, SimulationCommand, SimulationCommand.Result]
}

object Interaction {
  val panKey: GlobalStore.Key {
    type Data = js.Array[JSNumber]
  } = new GlobalStore.Key {
    override type Data = js.Array[Double] // To marshalling issues
    override val value: String = "pan"
  }
  /** The trait models the current mode of interaction. */
  trait State

  /** Pan mode allows the user to move the view. */
  case object Pan extends State

  /** Selection mode allows the user to select nodes to control or move them. */
  case object Selection extends State

  class PhaserInteraction(val commandInterpreter: CommandInterpreter[_, _, SimulationCommand, SimulationCommand.Result])
      extends Interaction {
    implicit val execution: Scheduler = Execution.timeoutBasedScheduler

    private var scene: Scene = _
    private var mainContainer: Container = _
    private var popup: NodeDescriptionPopup = _
    private val stateSubject = PublishSubject[State]
    private val selectionSubject = PublishSubject[Seq[String]]
    private var rectangleSelection: Rectangle = _
    private var selectionContainer: Container = _
    private val rectangleAlpha = 0.5
    private var positionBeforeDrag = (0.0, 0.0)
    private val selectionColor = Color.Red
    var state: State = Pan
    var selection: Option[Seq[String]] = None

    def onPhaserLoaded(scene: Scene, popup: NodeDescriptionPopup, container: Container): Unit = {
      this.scene = scene
      this.popup = popup
      this.mainContainer = container
      PageBus.listen { case _: SupportConfiguration => resetSelection() } // todo fix selection issue
      val position = GlobalStore.getOrElse(panKey)(js.Array(0, 0))
      mainContainer.setPosition(position(0), position(1))
      initRectangle()
      onDragStart()
      onDrag()
      onDragEnd()
    }

    override def changeTo(s: State): Unit = {
      // todo change cursor?? Thinking about..
      stateSubject.onNext(s)
      resetSelection()
      state = s
    }

    override def stateSource: Observable[State] = stateSubject.publish

    override def selectionSource: Observable[Seq[String]] = selectionSubject.publish

    def initRectangle(): Unit = {
      rectangleSelection =
        scene.add.rectangle(0, 0, 0, 0, fillColor = Color.Yellow, fillAlpha = rectangleAlpha).setOrigin(0)
      selectionContainer = scene.add.container(0, 0)
      mainContainer.add(selectionContainer)
      mainContainer.setInteractive()
      scene.input.setDraggable(mainContainer)
    }

    /** Attach to the main [[Container]] an event handler for the [[DRAG_START]] operation. */
    def onDragStart(): Unit = {
      mainContainer.on(
        DRAG_START,
        (_: Any, p: Pointer) =>
          (state, selection) match {
            case (Selection, None) =>
              rectangleSelection.setPosition(p.worldX, p.worldY)
            case (Selection, Some(_)) if rectangleSelection.getBounds().contains(p.worldX, p.worldY) =>
              positionBeforeDrag = selectionWorldCoordinate
            case (Selection, Some(_)) =>
              resetSelection()
              rectangleSelection.setPosition(p.worldX, p.worldY)
            case (Pan, _) =>
          }
      )
    }

    /** Attach to the main [[Container]] an event handler for the [[DRAG_END]] operation. */
    def onDragEnd(): Unit = {
      mainContainer.on(
        DRAG_END,
        (_: Any) =>
          (state, selection) match {
            case (Selection, None) =>
              evaluateSelection()
            case (Selection, _) =>
              val positionChangedMap = selectionContainer
                .list[GameObjects.Arc]
                .map(node => (node.id, (node.x + selectionContainer.x, node.y + selectionContainer.y)))
                .toMap
              commandInterpreter.execute(Move(positionChangedMap))
            case (Pan, _) =>
          }
      )
    }

    /** Attach to the main [[Container]] an event handler for the [[DRAG]] operation. */
    def onDrag(): Unit = {
      mainContainer.on(
        DRAG,
        (obj: Transform, p: Pointer, dx: JSNumber, dy: JSNumber, _: Any) =>
          (state, selection) match {
            case (Selection, None) =>
              rectangleSelection.setSize(p.worldX - rectangleSelection.x, p.worldY - rectangleSelection.y)
            case (Selection, Some(_)) =>
              selectionContainer.x += (dx + positionBeforeDrag._1) - rectangleSelection.x
              selectionContainer.y += (dy + positionBeforeDrag._2) - rectangleSelection.y
              rectangleSelection.setPosition(positionBeforeDrag._1 + dx, positionBeforeDrag._2 + dy)
            case (Pan, _) =>
              GlobalStore.put(panKey)(js.Array(dx, dy))
              obj.setPosition(dx, dy)
            case _ =>
          }
      )
    }

    def evaluateSelection(): Unit = {
      val (overlapX, overlapY) = selectionWorldCoordinate
      val (overlapWidth, overlapHeight) = (rectangleSelection.getBounds().width, rectangleSelection.getBounds().height)
      val elements = scene.physics.overlapRect(overlapX, overlapY, overlapWidth, overlapHeight, includeStatic = true)
      this.selection = Some(elements.map(_.gameObject.id).toSeq)
      this.selectionSubject.onNext(this.selection.get)
      elements
        .map { body =>
          val selected = scene.add.circle(body.center.x, body.center.y, body.halfWidth, selectionColor)
          selected.id = body.gameObject.id
        }
        .foreach(selectionContainer.add(_))

      if (overlapWidth == 0 && overlapHeight == 0 && elements.nonEmpty) {
        popup.focusOn(selectionContainer.list[Transform with GameObject].head)
      } // todo it is here? or in another place?
    }

    private def selectionWorldCoordinate: (Double, Double) = {
      val bounds = rectangleSelection.getBounds()
      (bounds.x - mainContainer.x, bounds.y - mainContainer.y)
    }

    private def resetSelection(): Unit = {
      rectangleSelection.setSize(0, 0)
      selectionContainer.removeAll()
      selectionContainer.setPosition(0, 0)
      rectangleSelection.setInteractive()
      selectionSubject.onNext(Seq.empty)
      this.selection = None
    }
  }

}
