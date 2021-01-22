package it.unibo.scafi.js.view.dynamic

import org.scalajs.dom.html.Element
import scalatags.JsDom.all._

import java.util.UUID
class Loader(element : Element) {
  private val idLoader = UUID.randomUUID().toString
  val loader = div(
    id := idLoader, cls := "spinner-grow text-light", role:="status", style := "width: 5rem; height: 5rem;",
    span(cls := "sr-only")
  ).render
  val backgroundLoader = div(cls := "bg-dark", style := "width : 100%; height : 100%").render
  backgroundLoader.style.position = "absolute"
  backgroundLoader.style.top = "0%"
  backgroundLoader.style.right = "0%"
  backgroundLoader.style.zIndex = "10"

  loader.style.zIndex = "100" //over the background
  loader.style.position = "absolute"
  loader.style.top = "40%"
  loader.style.right = "50%"
  element.appendChild(loader)
  element.appendChild(backgroundLoader)
  loaded()
  def load() : Unit = {
    loader.style.display = "block"
    backgroundLoader.style.display = "block"
    backgroundLoader.style.opacity = "0.9"
  }
  def loaded() : Unit = {
    backgroundLoader.style.display = "none"
    loader.style.display = "none"
  }
}
