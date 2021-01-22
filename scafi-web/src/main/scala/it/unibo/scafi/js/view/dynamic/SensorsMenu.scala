package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.{SimulationSupport, SupportConfiguration}
import it.unibo.scafi.js.view.HtmlRenderable
import org.scalajs.dom.html.{Anchor, Div, Span}
import scalatags.JsDom.all.{button, div, _}
import scalatags.JsDom.TypedTag

import scala.scalajs.js

trait SensorsMenu extends HtmlRenderable[Div] {

  def sensorsEnabled: Boolean

  def sensorEnabled(name: String): Boolean
}

object SensorsMenu {
  def apply(): SensorsMenu = new OldSensorCollapseMenu()

  private sealed class OldSensorCollapseMenu extends SensorsMenu {
    private val sensorSpan: Span = span(cls := "collapse", id := "sensorsSpan").render
    private val sensorButton: Anchor = a(
      cls := "btn btn-primary btn-sm mr-2 mt-1",
      attr("data-toggle") := "collapse",
      href := "#sensorsSpan",
      "sensors"
    ).render
    private var sensors: js.Dictionary[CheckBox] = js.Dictionary()

    EventBus.listen {
      case SupportConfiguration(_, _, device, _, _) =>
        sensorSpan.textContent = ""
        sensors = device.sensors.map { case (name, _) => name -> CheckBox(name) }
        val exportCheckbox = CheckBox(SimulationSupport.EXPORT_LABEL)
        exportCheckbox.check()
        sensors.put(SimulationSupport.EXPORT_LABEL, exportCheckbox)
        sensors.foreach(checkbox => sensorSpan.appendChild(checkbox._2.html))
    }

    override def sensorsEnabled: Boolean = sensors.exists { case (_, checkBox) => checkBox.enabled }

    override def sensorEnabled(name: String): Boolean = sensors.get(name).fold(false)(_.enabled)

    /**
      * @return the internal representation of the object under the html tag.
      */
    override val html: Div = div(cls := "form-group form-inline", sensorButton, sensorSpan).render
  }

  private sealed class SensorsMenuImpl extends SensorsMenu {

    EventBus.listen {
      case SupportConfiguration => // TODO
    }

    private lazy val dropdown: TypedTag[Div] = div(
      `class` := "dropdown",
      dropdown,
      sensors,
    )

    private lazy val dropdownButton = button(
      `class` := "btn btn-secondary dropdown-toggle",
      `type` := "button",
      id := "dropdownMenuButton",
      data("toggle") := "dropdown",
      aria.haspopup := true,
      aria.expanded := false,
      "Sensors",
    )

    private lazy val sensors = form(
      `class` := "dropdown-menu p-4",
      div(
        `class` := "form-group",
      )
    )

    override def sensorsEnabled: Boolean = ???

    override def sensorEnabled(name: String): Boolean = ???

    /**
      * @return the internal representation of the object under the html tag.
      */
    override def html: Div = ???
  }
}
