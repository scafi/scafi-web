package it.unibo.scafi.js.view

import org.querki.jquery.JQuery

import scala.scalajs.js
import scala.scalajs.js.|

@js.native
trait JQueryBootstrap extends JQuery {
  def modal(option: String): js.Any = js.native

  def popover(data: js.Object | String): js.Any = js.native
}

object JQueryBootstrap {
  implicit def fromJquery($: JQuery): JQueryBootstrap = $.asInstanceOf[JQueryBootstrap]
}
