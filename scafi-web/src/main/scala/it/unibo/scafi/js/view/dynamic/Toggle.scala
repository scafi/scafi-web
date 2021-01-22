package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.view.dynamic.graph.PhaserGraphSection.ForceRepaint
import it.unibo.scafi.js.view.HtmlRenderable
import org.scalajs.dom.html.Div
import scalatags.JsDom.all.{`for`, cls, div, id, input, label, tpe, _}

trait Toggle extends HtmlRenderable[Div] {
  def labelValue: String

  def enabled: Boolean

  def check(): Unit

  def uncheck(): Unit

  override val html: Div
}

object Toggle {
  def apply(labelValue: String, check: Boolean = false): Toggle = new ToggleFormRow(labelValue, check)

  class CheckBox(val labelValue: String, check: Boolean = false, inline: Boolean = true) extends Toggle {
    private val inputPart = input(cls := "form-check-input", tpe := "checkbox", id := labelValue).render

    inputPart.onclick = _ => EventBus.publish(ForceRepaint)

    def enabled: Boolean = inputPart.checked

    def check(): Unit = inputPart.checked = true

    def uncheck(): Unit = inputPart.checked = false

    val html: Div = div(
      cls := s"form-check ${if (inline) "form-check-inline" else ""}",
      inputPart,
      label(cls := "form-check-label text-light", `for` := labelValue, labelValue),
      checked := check
    ).render
  }

  class ToggleFormRow(val labelValue: String, check: Boolean = false) extends Toggle {
    private lazy val toggle = input(
      `type` := "checkbox",
      `class` := "custom-control-input",
      id := s"$labelValue-toggle",
      checked := check
    ).render

    /**
      * @return the internal representation of the object under the html tag.
      */
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

  /*class SensorLine(labelValue: String) extends CheckBox(labelValue) {
  private val formGroup: Div = super.html

  private val valueToggleInput = input(tpe := "checkbox", cls := "custom-control-input", id := s"toggle-$labelValue")

  private val valueToggle = div(
    cls := "custom-control custom-switch",
    valueToggleInput
  )

  override val html: Div = {
    formGroup.appendChild()
    div(
      cls := "form-group",
      div(

      )
    )
  }
}*/
}
