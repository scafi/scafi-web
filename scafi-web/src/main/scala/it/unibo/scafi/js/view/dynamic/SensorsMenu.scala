package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.{SimulationSupport, SupportConfiguration}
import it.unibo.scafi.js.view.HtmlRenderable
import org.scalajs.dom.html.{Anchor, Div, Span}
import scalatags.JsDom.all.{button, div, _}

import scala.scalajs.js

trait SensorsMenu extends HtmlRenderable[Div] {

  def sensorsEnabled: Boolean

  def sensorEnabled(name: String): Boolean
}

object SensorsMenu {
  def apply(): SensorsMenu = new DropdownSensorsMenu()

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
//        sensors = device.sensors.map { case (name, _) => name -> Toggle(name) }
//        val exportCheckbox = Toggle(SimulationSupport.EXPORT_LABEL, check = true)
//        sensors.put(SimulationSupport.EXPORT_LABEL, exportCheckbox)
        sensors = device
          .sensors
          .map { case (name, _) => name -> Toggle(name) }
          .+= (SimulationSupport.EXPORT_LABEL -> Toggle(SimulationSupport.EXPORT_LABEL, check = true))
        sensors.foreach(checkbox => sensorsForm.appendChild(checkbox._2.html))
    }
  }

}
