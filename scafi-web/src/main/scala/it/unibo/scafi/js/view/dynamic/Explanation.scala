package it.unibo.scafi.js.view.dynamic

import org.scalajs.dom.html.Div
import org.scalajs.dom.raw.CSSStyleDeclaration

import scala.scalajs.js

object Explanation {
  @js.native
  trait RichStyle extends CSSStyleDeclaration {
    var filter : String = ???
  }
  implicit def richStyle(css : CSSStyleDeclaration) : RichStyle = css.asInstanceOf[RichStyle] //js stuff..

  def focus(div : Div) : Unit = {
    div.style.filter = "blur(1px)"
  }
  def unfocus(div : Div) : Unit = {
    div.style.filter = "blur(0px)"
  }
  def render(configDiv : Div,simulationDiv : Div) : Unit = {
    Seq(configDiv, simulationDiv) foreach focus
  }
}
