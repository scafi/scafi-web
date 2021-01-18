package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.controller.CommandInterpreter
import it.unibo.scafi.js.controller.local.SimulationCommand
import it.unibo.scafi.js.facade.phaser.Phaser.{Events, Scene}
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.{Container, Rectangle}
import it.unibo.scafi.js.view.dynamic.graph.Interaction.State
import monix.reactive.Observable
import monix.reactive.subjects.PublishSubject
import org.scalajs.dom.ext.Color
import it.unibo.scafi.js.facade.phaser.Implicits._
import it.unibo.scafi.js.facade.phaser.Phaser.Input.Events._
import it.unibo.scafi.js.utils.Execution
trait Interaction {
  def state : State
  def selection : Option[Set[String]]
  def changeTo(s : State) : Unit
  def stateSource : Observable[State]
  def selectionSource : Observable[Set[String]]
}

object Interaction {
  trait State
  case object Pan extends State
  case object Selection extends State
  class PhaserInteraction(private val commandInterpreter: CommandInterpreter[_, _, SimulationCommand, SimulationCommand.Result])
    extends Interaction {
    implicit val execution = Execution.timeoutBasedScheduler
    private var scene : Scene = _
    private var mainContainer : Container = _
    private var popup : NodeDescriptionPopup = _
    private val stateSubject = PublishSubject[State]
    private val selectionSubject = PublishSubject[Set[String]]
    private var rectangleSelection : Rectangle = _
    private var selectionContainer : Container = _
    private val rectangleAlpha = 0.5
    private val selectionColor = Color.Red
    var state: State = Pan
    var selection: Option[Set[String]] = None
    def onPhaserLoaded(scene : Scene, popup: NodeDescriptionPopup, container: Container) : Unit = {
      this.scene = scene
      this.popup = popup
      this.mainContainer = container
      initRectangle()
      onDragStart()
      onDrag()
      onDragEnd()
      onClick()
    }

    def initRectangle() : Unit = {
      rectangleSelection = scene.add.rectangle(0, 0, 0, 0, fillColor = Color.White, fillAlpha = rectangleAlpha).setOrigin(0)
      selectionContainer = scene.add.container(0, 0)
      mainContainer.add(selectionContainer)
      mainContainer.setInteractive()
      scene.input.setDraggable(mainContainer)
    }

    def onDragStart() : Unit = {
      mainContainer.on(DRAG_START, (a : Any) => println(a))
      mainContainer.on(DRAG, (a : Any) => println(a))
      mainContainer.on(DRAG_END, (a : Any) => println(a))
    }
    def onDragEnd() : Unit = {
      mainContainer.on(DRAG_START, (a : Any) => println(a))
      mainContainer.on(DRAG, (a : Any) => println(a))
      mainContainer.on(DRAG_END, (a : Any) => println(a))
    }
    def onDrag() : Unit = {
      mainContainer.on(DRAG_START, (a : Any) => println(a))
      mainContainer.on(DRAG, (a : Any) => println(a))
      mainContainer.on(DRAG_END, (a : Any) => println(a))
    }

    def onClick() : Unit = {

    }

    override def changeTo(s: State): Unit = {
      //change cursor?? Thinking about..
      stateSubject.onNext(s)
      state match {
        case Pan => resetSelection()
      }
      state = s
    }

    override def stateSource: Observable[State] = stateSubject.publish

    override def selectionSource: Observable[Set[String]] = selectionSubject.publish

    private def resetSelection() : Unit = {

    }
  }
}
