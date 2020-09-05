package it.unibo.scafi.js.view

import org.scalajs.dom.Element

trait HtmlRenderable[+Tag <: Element] {
  def html : Tag
}

object HtmlRenderable {
  implicit def toRenderable[E <: Element](element: E) : HtmlRenderable[E] = new HtmlRenderable[E] {
    override def html: E = element
  }
}
