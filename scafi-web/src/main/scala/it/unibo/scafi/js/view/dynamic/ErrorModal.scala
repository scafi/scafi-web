package it.unibo.scafi.js.view.dynamic
import it.unibo.scafi.js.facade.simplebar.SimpleBar
import org.scalajs.dom.document
import org.scalajs.dom.html.Element
import scalatags.JsDom.all._

object ErrorModal extends Modal {
  private val text = pre(cls := "overflow-auto", style := "max-height : 50vh").render// init the page
  private var bar : SimpleBar = null
  override val title: Element = h4(cls := "modal-tile", "Error!").render
  override val body: Seq[Element] = Seq(text)
  override val footer: Seq[Element] = Seq.empty
  override def minBound: Double = 0
  def showError(error : String) : Unit = {
      text.innerHTML = error
      bar = SimpleBar.wrap(text) //with hide, the simple bar has some problem... with rewrapping it seems to work
      this.toggle()
  }
  document.body.appendChild(this.html) //put in the page..
  onClose = _ => {
    bar.unMount()
    this.hide()
  }
}
