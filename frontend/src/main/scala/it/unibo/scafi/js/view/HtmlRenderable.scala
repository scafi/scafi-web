package it.unibo.scafi.js.view

import org.scalajs.dom.Element

import scala.language.implicitConversions

/** Describe a general that has a html representation.
  *
  * @tparam Tag
  *   the type of html tag (Div, Canvas,..).
  */
trait HtmlRenderable[+Tag <: Element] {
  /** @return the internal representation of the object under the html tag. */
  def html: Tag
}

object HtmlRenderable {
  /** Wrap a html element in a HtmlRenderable (it can be useful in collection).
    *
    * @param element
    *   the html element (div, p,...).
    * @tparam E
    *   the concrete tag type.
    * @return
    *   the HtmlRenderable wrapper.
    */
  implicit def toRenderable[E <: Element](element: E): HtmlRenderable[E] = new HtmlRenderable[E] {
    override def html: E = element
  }
}
