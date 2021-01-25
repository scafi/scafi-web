package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.{SimulationSupport, SupportConfiguration}
import it.unibo.scafi.js.controller.local.SimulationCommand.ToggleSensor
import it.unibo.scafi.js.view.HtmlRenderable
import it.unibo.scafi.js.view.dynamic.graph.Interaction
import org.scalajs.dom.html.Div
import org.scalajs.dom.raw.MouseEvent
import scalatags.JsDom.all.{button, div, _}

import scala.scalajs.js

trait SensorsMenu extends HtmlRenderable[Div] {}

object SensorsMenu {
  def apply(interaction: Interaction): SensorsMenu = new DropdownSensorsMenu(interaction)

  private sealed class DropdownSensorsMenu(interaction: Interaction) extends SensorsMenu {
    private var sensors: js.Dictionary[Toggle] = js.Dictionary()

    private lazy val dropdownButton = button(
      cls := "btn btn-primary ml-1 btn-sm dropdown-toggle",
      `type` := "button",
      id := "dropdownMenuButton",
      data("toggle") := "dropdown",
      aria.haspopup := true,
      aria.expanded := false,
      "Sensors",
    ).render

    private lazy val sensorsGroup = div(cls := "form-group").render


    override val html: Div = div(
      cls := "dropdown",
      dropdownButton,
      form(
        cls := "dropdown-menu bg-dark p-2",
        sensorsGroup
      ),
    ).render

    PageBus.listen {
      case SupportConfiguration(_, _, device, _, _) =>
        sensorsGroup.textContent = ""
        sensors = device
          .sensors
          .collect { case (name, _ : Boolean) =>
            name -> Toggle.button(
              labelValue = name,
              onClick = (e: MouseEvent) => {
                val ids = interaction.selection.map(_.toSet).getOrElse(Set())
                interaction.commandInterpreter.execute(ToggleSensor(name, ids))
                Toggle.Repaint(e)
              })
          }
        sensors
          .map { case (_, toggle) => toggle }
          .foreach(toggle => sensorsGroup.appendChild(toggle.html))
    }
  }

}
