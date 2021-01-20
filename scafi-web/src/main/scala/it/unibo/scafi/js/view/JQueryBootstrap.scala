package it.unibo.scafi.js.view

import org.querki.jquery.JQuery

import scala.scalajs.js
import scala.scalajs.js.|

@js.native
trait JQueryBootstrap extends JQuery {
  def modal(option: String): js.Any = js.native

  def popover(data: js.Object | String): js.Any = js.native

  def selectpicker() : js.Any = js.native

  def resizable(opt : js.Object)
}

object JQueryBootstrap {
  import scala.language.implicitConversions

  implicit def fromJquery($: JQuery): JQueryBootstrap = $.asInstanceOf[JQueryBootstrap]
}
