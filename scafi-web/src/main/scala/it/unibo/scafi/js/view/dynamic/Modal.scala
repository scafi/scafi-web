package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.view.HtmlRenderable
import it.unibo.scafi.js.view.JQueryBootstrap._
import org.querki.jquery.$
import org.scalajs.dom.document
import org.scalajs.dom.html.{Button, Element}
import org.scalajs.dom.raw.MouseEvent
import scalatags.JsDom.all._

import java.util.UUID
import scala.scalajs.js

trait Modal extends HtmlRenderable[Element] {
  private val closeButton: Button = button(`type` := "button", cls := "close text-danger", span("×")).render
  closeButton.onclick = ev => onClose(ev)
  lazy val modalId: String = UUID.randomUUID().toString

  def title: Element

  def body: Seq[Element]

  def footer: Seq[Element]

  def minBound: Double

  def toggle(): Unit = $(s"#$modalId").modal("toggle")

  def show(): Unit = $(s"#$modalId").modal("show")

  def hide(): Unit = $(s"#$modalId").modal("hide")

  def dispose(): Unit = $(s"#$modalId").modal("dispose")

  def bodyStyle: String = ""

  def footerStyle: String = ""

  def headerStyle: String = ""

  var onClose: MouseEvent => Unit = e => hide()

  override lazy val html: Element = div(
    role := "dialog",
    cls := "modal",
    tabindex := "-1",
    id := this.modalId,
    div(
      style := s"min-width: ${minBound}px",
      cls := "modal-dialog",
      role := "document",
      div(
        cls := "modal-content bg-secondary text-light",
        div(cls := "modal-header", style := headerStyle, title, closeButton),
        div(cls := "modal-body", style := bodyStyle, body),
        div(cls := "modal-footer", style := footerStyle, footer)
      )
    )
  ).render

  def appendOnRoot(): Unit = document.body.appendChild(html)
}

object Modal {

  case class BaseModal(title: Element, body: Seq[Element], footer: Seq[Element], minBound: Double) extends Modal {}

  case class ZeroPaddingModal(title: Element, body: Seq[Element], footer: Seq[Element], minBound: Double) extends Modal {
    override def bodyStyle: String = "padding : 0 !important"

    override def footerStyle: String = "padding : 0 !important"
  }

  /**
    * Generate a pure textual modal popup window, with a title and a footer.
    *
    * @param title the text of the title
    * @param body  the text of the body
    * @param width the minimum bound of the width of the window
    * @return the generated modal
    */
  def textual(title: String, body: String, width: Double): BaseModal =
    textualWithFooter(title, body, width)(Option.empty)

  /**
    * Generate a textual modal which lets also set a component to put in the footer.
    *
    * @param title  the text of the title
    * @param body   the text of the body
    * @param width  the minimum bound of the width of the window
    * @param footer the component to put in the footer
    * @return the generated modal
    */
  def textualWithFooter(title: String, body: String, width: Double)(footer: Option[Element]): BaseModal = BaseModal(
    title = h6(cls := "modal-tile", title).render,
    body = Seq(div(p(body), style := "padding : 5").render),
    footer = footer.toList,
    minBound = width
  )

  /**
    * Generate a modal window with to buttons, OK and Cancel.
    *
    * @param title    the text of the title
    * @param body     the text of the body
    * @param onOk     what to do when OK button is pressed
    * @param onCancel what to do when cancel button is pressed
    * @return the generated modal
    */
  def okCancel(title: String, body: String, onOk: () => Unit, onCancel: () => Unit): Modal = {
    val ok = button(cls := "btn btn-warning", "Ok").render
    val cancel = button(cls := "btn btn-dark", "Cancel").render
    ok.onclick = _ => onOk()
    cancel.onclick = _ => onCancel()
    val base = textual(title, body, 0).copy(footer = Seq(ok, cancel))
    val function: js.Function0[Unit] = () => onCancel()
    base.appendOnRoot()
    $(s"#${base.modalId}").on("hidden.bs.modal", function)
    base
  }
}
