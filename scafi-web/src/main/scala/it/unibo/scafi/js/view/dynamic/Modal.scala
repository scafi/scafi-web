package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.view.HtmlRenderable
import it.unibo.scafi.js.view.JQueryBootstrap._
import org.querki.jquery.$
import org.scalajs.dom.html.{Button, Element}
import org.scalajs.dom.raw.MouseEvent
import scalatags.JsDom.all._

import java.util.UUID

trait Modal extends HtmlRenderable[Element] {
  private val closeButton : Button = button(`type` := "button", cls := "close", span("×")).render
  closeButton.onclick = ev => onClose(ev)
  lazy val modalId : String = UUID.randomUUID().toString
  def title : Element
  def body : Seq[Element]
  def footer : Seq[Element]
  def minBound : Double
  def toggle() : Unit = $(s"#$modalId").modal("toggle")
  def show() : Unit = $(s"#$modalId").modal("show")
  def hide() : Unit = $(s"#$modalId").modal("hide")
  def dispose() : Unit = $(s"#$modalId").modal("dispose")
  def bodyStyle : String = ""
  def footerStyle : String = ""
  def headerStyle : String = ""
  var onClose : (MouseEvent) => Unit = e => hide()
  override lazy val html: Element = div(role := "dialog", cls :="modal", tabindex := "-1", id := { this.modalId },
    div(
      style := s"min-width: ${minBound}px",
      cls := "modal-dialog", role := "document",
      div(
        cls := "modal-content",
        div(cls := "modal-header", style := headerStyle, title, closeButton),
        div(cls := "modal-body", style := bodyStyle, body),
        div(cls := "modal-footer", style := footerStyle, footer)
      )
    )
  ).render
}

object Modal {
  case class BaseModal(title : Element, body : Seq[Element], footer : Seq[Element], minBound : Double) extends Modal {}

  case class ZeroPaddingModal(title : Element, body : Seq[Element], footer : Seq[Element], minBound : Double) extends Modal {
    override def bodyStyle : String = "padding : 0 !important"
    override def footerStyle : String = "padding : 0 !important"
  }

  def textual(title : String, body : String, width : Double) : Modal = BaseModal(
    h6(cls := "modal-tile", title).render,
    Seq(div(p(body), style := "padding : 5").render),
    Seq.empty, width
  )
}