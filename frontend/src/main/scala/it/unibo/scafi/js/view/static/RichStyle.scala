package it.unibo.scafi.js.view.static

import org.scalajs.dom.raw.CSSStyleDeclaration

import scala.scalajs.js

@js.native
trait RichStyle extends CSSStyleDeclaration {
  var filter: String = ???
}

object RichStyle {
  implicit def richStyle(css: CSSStyleDeclaration): RichStyle = css.asInstanceOf[RichStyle] // js stuff..
}
