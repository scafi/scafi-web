package it.unibo.scafi.js.view.dynamic
import org.scalajs.dom.document
import org.scalajs.dom.html.Element
import scalatags.JsDom.all.{cls, h6}
import scalatags.JsDom.all._

object ErrorModal extends Modal {
  private val text = p().render
  override val title: Element = h6(cls := "modal-tile", "Error!").render
  override val body: Seq[Element] = Seq(text)
  override val footer: Seq[Element] = Seq.empty
  override def minBound: Double = 0
  def showError(error : String) : Unit = {
    text.innerHTML = error
    this.toggle()
  }
  document.body.appendChild(this.html) //put in the page..
}
