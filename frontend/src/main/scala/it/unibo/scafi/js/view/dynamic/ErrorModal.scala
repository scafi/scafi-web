package it.unibo.scafi.js.view.dynamic
import org.scalajs.dom.html.Element
import scalatags.JsDom.all._

object ErrorModal extends Modal {
  private val text = pre(cls := "overflow-auto text-light", style := "max-height : 50vh").render // init the page
  override val title: Element = h4(cls := "modal-tile", "Error!").render
  override val body: Seq[Element] = Seq(text)
  override val footer: Seq[Element] = Seq.empty
  override def minBound: Double = 0
  def showError(error: String): Unit = {
    text.innerHTML = error
    this.toggle()
  }
  this.appendOnRoot() // put in the page..
  onClose = () => {
    this.hide()
  }
}
