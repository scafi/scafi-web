package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.{SimulationSupport, SupportConfiguration}
import it.unibo.scafi.js.view.HtmlRenderable
import it.unibo.scafi.js.view.dynamic.Toggle.{CheckBox, ToggleFormRow}
import org.scalajs.dom.html.{Anchor, Div, Span}
import scalatags.JsDom.all.{button, div, _}

import scala.scalajs.js

trait SensorsMenu extends HtmlRenderable[Div] {

  def sensorsEnabled: Boolean

  def sensorEnabled(name: String): Boolean
}

object SensorsMenu {
  def apply(): SensorsMenu = new DropdownSensorsMenu()

  private sealed class OldSensorCollapseMenu extends SensorsMenu {
    private val sensorSpan: Span = span(cls := "collapse", id := "sensorsSpan").render
    private val sensorButton: Anchor = a(
      cls := "btn btn-primary btn-sm mr-2 mt-1",
      attr("data-toggle") := "collapse",
      href := s"#${sensorSpan.id}",
      "sensors"
    ).render
    private var sensors: js.Dictionary[Toggle] = js.Dictionary()

    EventBus.listen {
      case SupportConfiguration(_, _, device, _, _) =>
        sensorSpan.textContent = ""
//        sensors = device.sensors.map { case (name, _) => name -> new CheckBox(name) }
//        val exportCheckbox = new CheckBox(SimulationSupport.EXPORT_LABEL, check = true)
//        sensors.put(SimulationSupport.EXPORT_LABEL, exportCheckbox)
        sensors = device
          .sensors
          .map { case (name, _) => name -> Toggle(name) }
          .+= (SimulationSupport.EXPORT_LABEL -> Toggle(SimulationSupport.EXPORT_LABEL))
        sensors.foreach(checkbox => sensorSpan.appendChild(checkbox._2.html))
    }

    override def sensorsEnabled: Boolean = sensors.exists { case (_, checkBox) => checkBox.enabled }

    override def sensorEnabled(name: String): Boolean = sensors.get(name).fold(false)(_.enabled)

    /**
      * @return the internal representation of the object under the html tag.
      */
    override val html: Div = div(cls := "form-group form-inline", sensorButton, sensorSpan).render
  }

  private sealed class DropdownSensorsMenu extends SensorsMenu {
    private var sensors: js.Dictionary[Toggle] = js.Dictionary()

    private lazy val dropdown: Div = div(
      cls := "dropdown",
      dropdownButton,
      form(
        cls := "dropdown-menu bg-dark p-2",
        sensorsForm
      ),
    ).render

    private lazy val dropdownButton = button(
      cls := "btn btn-primary ml-1 btn-sm dropdown-toggle",
      `type` := "button",
      id := "dropdownMenuButton",
      data("toggle") := "dropdown",
      aria.haspopup := true,
      aria.expanded := false,
      "Sensors",
    ).render

    private lazy val sensorsForm = div(cls := "form-group").render

    override def sensorsEnabled: Boolean = sensors.exists { case (_, checkBox) => checkBox.enabled }

    override def sensorEnabled(name: String): Boolean = sensors.get(name).fold(false)(_.enabled)

    override def html: Div = dropdown

    EventBus.listen {
      case SupportConfiguration(_, _, device, _, _) =>
        sensorsForm.textContent = ""
//        sensors = device.sensors.map { case (name, _) => name -> new CheckBox(name, inline = false) }
//        val exportCheckbox = new CheckBox(SimulationSupport.EXPORT_LABEL, check = true, inline = false)
//        sensors.put(SimulationSupport.EXPORT_LABEL, exportCheckbox)
        sensors = device
          .sensors
          .map { case (name, _) => name -> Toggle(name) }
          .+= (SimulationSupport.EXPORT_LABEL -> Toggle(SimulationSupport.EXPORT_LABEL))
        sensors.foreach(checkbox => sensorsForm.appendChild(checkbox._2.html))
    }
  }

}
