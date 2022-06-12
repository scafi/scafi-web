package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.view.dynamic.graph.PhaserGraphSection.ForceRepaint
import it.unibo.scafi.js.view.HtmlRenderable
import org.scalajs.dom.html.Div
import org.scalajs.dom.raw.MouseEvent
import scalatags.JsDom.all.{`for`, cls, div, id, input, label, tpe, _}

import scala.scalajs.js

trait Toggle extends HtmlRenderable[Div] {
  def labelValue: String

  def enabled: Boolean

  def check(): Unit

  def uncheck(): Unit

  override val html: Div
}

object Toggle {
  val Repaint: js.Function1[MouseEvent, _] = _ => PageBus.publish(ForceRepaint)

//  /**
//    * Build a simple '''toggle'''.
//    *
//    * @param labelValue the label attached to the toggle
//    * @param check whether the toggle should be checked or not
//    * @return the toggle
//    */
//  def apply(labelValue: String, check: Boolean = false): Toggle =
//    new ToggleFormRow(labelValue, check)
//
//  /**
//    * Build a simple '''checkbox'''.
//    *
//    * @param labelValue the label attached to the checkbox
//    * @param check whether the checkbox should be checked or not
//    * @param inline whether the checkbox should be inline or not
//    * @return the checkbox
//    */
//  def apply(labelValue: String, check: Boolean = false, inline: Boolean): Toggle =
//    new CheckBox(labelValue, check, inline)

  /** Build a '''toggle''' with a specified behavior.
    *
    * @param labelValue
    *   the label attached to the toggle
    * @param check
    *   whether the toggle should be checked or not
    * @param onClick
    *   what to do when the toggle is clicked
    * @return
    *   the toggle
    */
  def apply(labelValue: String, check: Boolean = false, onClick: js.Function1[MouseEvent, _]): Toggle =
    new ToggleFormRow(labelValue, check, onClick)

  def button(labelValue: String, check: Boolean = false, onClick: js.Function1[MouseEvent, _]): Toggle =
    new ToggleWithButton(labelValue, check, onClick)

  /*private*/
  class CheckBox(val labelValue: String, check: Boolean = false, inline: Boolean = true) extends Toggle {
    private val inputPart = input(
      cls := "form-check-input",
      tpe := "checkbox",
      id := labelValue
    ).render

    inputPart.checked = check

    inputPart.onclick = Repaint

    def enabled: Boolean = inputPart.checked

    def check(): Unit = inputPart.checked = true

    def uncheck(): Unit = inputPart.checked = false

    lazy val html: Div = div(
      cls := s"form-check ${if (inline) "form-check-inline" else ""}",
      inputPart,
      label(cls := "form-check-label text-light", `for` := labelValue, labelValue)
    ).render
  }

  class ToggleFormRow(val labelValue: String, check: Boolean = false, onClick: js.Function1[MouseEvent, _] = Repaint)
      extends Toggle {
    private lazy val toggle = input(
      `type` := "checkbox",
      `class` := "custom-control-input",
      id := s"$labelValue-toggle"
    ).render

    toggle.checked = check

    toggle.onclick = onClick

    /** @return the internal representation of the object under the html tag. */
    override lazy val html: Div = div(
      `class` := "form-row",
      div(
        `class` := "col",
        div(
          `class` := "custom-control custom-switch",
          this.toggle,
          label(
            `class` := "custom-control-label text-white",
            `for` := this.toggle.id,
            this.labelValue
          )
        )
      )
    ).render

    override def enabled: Boolean = toggle.checked

    override def check(): Unit = toggle.checked = true

    override def uncheck(): Unit = toggle.checked = false
  }

  class ToggleWithButton(val labelValue: String, check: Boolean = false, onClick: js.Function1[MouseEvent, _] = Repaint)
      extends Toggle {
    private var _check = check
    private lazy val toggle = input(
      `type` := "button",
      `class` := "btn btn-sm bg-primary mr-2 text-white",
      id := s"$labelValue-toggle",
      value := s"toggle"
    ).render

    toggle.onclick = ev => {
      _check = !_check
      onClick(ev)
    }

    /** @return the internal representation of the object under the html tag. */
    override lazy val html: Div = div(
      `class` := "form-row mt-2",
      div(
        `class` := "form-inline",
        this.toggle,
        label(
          `class` := "text-white",
          `for` := this.toggle.id,
          this.labelValue
        )
      )
    ).render

    override def enabled: Boolean = _check

    override def check(): Unit = _check = true

    override def uncheck(): Unit = _check = false
  }
}
