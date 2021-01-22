package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.view.dynamic.graph.PhaserGraphSection.ForceRepaint
import it.unibo.scafi.js.view.HtmlRenderable
import org.scalajs.dom.html.Div
import scalatags.JsDom.all.{`for`, cls, div, id, input, label, tpe}
import scalatags.JsDom.all._

case class CheckBox(labelValue: String) extends HtmlRenderable[Div] {
  private val inputPart = input(cls := "form-check-input", tpe := "checkbox", id := labelValue).render

  inputPart.onclick = _ => EventBus.publish(ForceRepaint)

  def enabled: Boolean = inputPart.checked

  def check(): Unit = inputPart.checked = true

  def uncheck(): Unit = inputPart.checked = false

  val html: Div = div(
    cls := "form-check form-check-inline",
    inputPart,
    label(cls := "form-check-label text-light", `for` := labelValue, labelValue)
  ).render
}
