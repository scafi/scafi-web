package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.view.static.RichStyle._
import org.scalajs.dom.html.Div

object Explanation {
  def focus(div: Div): Unit = {
    div.style.filter = "blur(1px)"
  }

  def unfocus(div: Div): Unit = {
    div.style.filter = "blur(0px)"
  }

  def render(configDiv: Div, simulationDiv: Div): Unit = {
    Seq(configDiv, simulationDiv) foreach focus
  }
}
