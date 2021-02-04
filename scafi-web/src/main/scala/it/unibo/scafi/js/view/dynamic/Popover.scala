package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.view.JQueryBootstrap._
import it.unibo.scafi.js.view.dynamic.Popover.{Direction, template}
import org.querki.jquery.$
import org.scalajs.dom.html.Element

import scala.scalajs.js

case class Popover(attachTo: String, data: Element, title: String, direction: Direction, trigger: String = "manual") {
  val options: js.Object with js.Dynamic = js.Dynamic.literal(
    "animation" -> false,
    "html" -> true,
    "sanitize" -> false,
    "placement" -> direction.value,
    "template" -> template,
    "trigger" -> trigger,
    "content" -> data,
    "title" -> title
  )
  $(s"#$attachTo").popover(options)

  def toggle(): Unit = $(s"#$attachTo").popover("toggle")

  def show(): Unit = $(s"#$attachTo").popover("show")

  def hide(): Unit = $(s"#$attachTo").popover("hide")
}

object Popover {
  private val template =
    """<div class="popover bg-secondary" role="tooltip">
      | <div class="arrow">
      | </div><h3 class="popover-header bg-info"></h3>
      | <div class="popover-body"></div>
      |</div>'""".stripMargin
  sealed abstract class Direction(val value: String)

  case object Top extends Direction("top")

  case object Bottom extends Direction("bottom")

  case object Left extends Direction("left")

  case object Right extends Direction("right")

}
