package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.view.dynamic.Popover.Direction
import it.unibo.scafi.js.view.dynamic.ThemeSwitcher.{install, theme, Light}
import it.unibo.scafi.js.view.static.RootStyle.smallPrimaryBtnClass
import org.scalajs.dom.html.Form
import scalatags.JsDom.all._

import scala.scalajs.js

trait PopoverProgression {

  /** Show next [[Popover]]. */
  def stepForward()

  /** Close current [[Popover]] and end the progression. */
  def end()

  /** (Re)start the sequence of [[Popover]]s. */
  def restart()
}

object PopoverProgression {

  trait Builder {
    /**
      * Add a step popover.
      *
      * @param attachTo  the id of the element to attach the popover to
      * @param title     the title of the popover modal
      * @param text      the body of the popover modal
      * @param direction the direction of the popover arrow
      */
    def addNextPopover(attachTo: String, title: String, text: String, direction: Direction = Popover.Bottom): Builder

    def andFinally(action: () => Unit): Builder

    /** Start the tour. */
    def start(): PopoverProgression
  }

  object Builder {
    def apply(): Builder = new PopoverProgressionBuilder()

    private sealed class PopoverProgressionBuilder extends Builder {
      private val popoverTour: PopoverTour = PopoverTour(Seq.empty)

      /** @inheritdoc */
      override def addNextPopover(attachTo: String, title: String, text: String, direction: Direction = Popover.Bottom): Builder = {
        lazy val nextBtn = button(cls := smallPrimaryBtnClass("ml-1 mr-1"), `type` := "button", "OK").render
        nextBtn.onclick = _ => popoverTour.stepForward()
        lazy val exitBtn = button(cls := smallPrimaryBtnClass("ml-1 mr-1"), `type` := "button", "Close").render
        exitBtn.onclick = _ => popoverTour.end()
        popoverTour.popovers = popoverTour.popovers :+ Popover(attachTo, data = div(
          p(text),
          div(cls := "text-center", nextBtn, exitBtn)
        ).render, title, direction)
        this
      }

      /** @inheritdoc */
      override def start(): PopoverProgression = popoverTour

      override def andFinally(action: () => Unit): Builder = {
        popoverTour.doFinally = Some(action)
        this
      }
    }

    private sealed case class PopoverTour(var popovers: Seq[Popover]) extends PopoverProgression {
      private var iterator: Option[Iterator[Popover]] = None
      private var current: Option[Popover] = None
      var doFinally: Option[() => Unit] = None

      /** Show next [[Popover]]. */
      override def stepForward(): Unit = {
        (iterator, current) match {
          case (None, _) | (_, None) =>
            restart()
          case (Some(iter), Some(curr)) if iter.hasNext =>
            curr.hide()
            val next = iter.next()
            current = Some(next)
            next.show()
          case (Some(iter), Some(_)) if !iter.hasNext =>
            end()
        }
      }

      override def end(): Unit = {
        current.foreach(curr => curr.hide())
        current = None
        doFinally match {
          case Some(action) => action()
        }
      }

      override def restart(): Unit = {
        val iter = popovers.iterator
        iterator = Some(iter)
        val cur = iter.next()
        current = Some(cur)
        cur.show()
      }
    }
  }

  object ResetButton {
    def render(popoverProgression: PopoverProgression, rightSideBar: Form): Unit = {
      lazy val restartButton = a(
          cls := "btn btn-outline-light my-2 my-sm-0 ml-2",
          i(cls := "far fa-question-circle fa-lg", aria.hidden := true)
        ).render
      restartButton.onclick = _ => popoverProgression.restart()
      rightSideBar.appendChild(restartButton)
    }
  }
}
