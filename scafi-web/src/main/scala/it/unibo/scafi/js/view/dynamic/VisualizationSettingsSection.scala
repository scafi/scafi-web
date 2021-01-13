package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.{SimulationSupport, SupportConfiguration}
import it.unibo.scafi.js.facade.simplebar.SimpleBar
import it.unibo.scafi.js.view.HtmlRenderable
import it.unibo.scafi.js.view.dynamic.graph.PhaserGraphSection.ForceRepaint
import org.scalajs.dom.html.Div
import scalatags.JsDom.all._

import scala.scalajs.js

trait VisualizationSettingsSection {
  def idEnabled: Boolean

  def neighbourhoodEnabled: Boolean

  def anyLabelEnabled: Boolean

  def sensorEnabled(name: String): Boolean
}

object VisualizationSettingsSection {
  def apply(settingDiv: Div): VisualizationSettingsSection = new VisualizationSettingsSectionImpl(settingDiv)

  private class VisualizationSettingsSectionImpl(settingDiv: Div) extends VisualizationSettingsSection {
    private val sensorSpan = span(cls := "collapse", id := "sensorsSpan").render
    private val sensorButton = a(cls := "btn btn-primary btn-sm mr-2 mt-1", attr("data-toggle") := "collapse", href := "#sensorsSpan", "sensors")
    private var sensors: js.Dictionary[CheckBox] = js.Dictionary()
    private val idEnabledSection = CheckBox("id")
    private val neighbourhoodSection = CheckBox("neighborhood")

    def idEnabled: Boolean = idEnabledSection.enabled

    def neighbourhoodEnabled: Boolean = neighbourhoodSection.enabled

    def anyLabelEnabled: Boolean = sensors.exists { case (_, checkBox) => checkBox.enabled } || idEnabled

    def sensorEnabled(name: String): Boolean = sensors.get(name).fold(false)(_.enabled)

    EventBus.listen {
      case SupportConfiguration(_, _, device, _, _) => sensorSpan.textContent = ""
        sensors = device.sensors.map { case (name, _) => name -> CheckBox(name) }
        val exportCheckbox = CheckBox(SimulationSupport.EXPORT_LABEL)
        exportCheckbox.check
        sensors.put(SimulationSupport.EXPORT_LABEL, exportCheckbox)
        sensors.foreach(checkbox => sensorSpan.appendChild(checkbox._2.html))
    }
    idEnabledSection.check
    neighbourhoodSection.check
    settingDiv.appendChild(idEnabledSection.html)
    settingDiv.appendChild(sensorButton.render)
    settingDiv.appendChild(sensorSpan)
    settingDiv.appendChild(neighbourhoodSection.html)
    new SimpleBar(settingDiv)
  }

  private case class CheckBox(labelValue: String) extends HtmlRenderable[Div] {
    private val inputPart = input(cls := "form-check-input", tpe := "checkbox", id := labelValue).render
    inputPart.onclick = _ => EventBus.publish(ForceRepaint)

    def enabled: Boolean = inputPart.checked

    def check: Unit = inputPart.checked = true

    def uncheck: Unit = inputPart.checked = false

    val html = div(
      cls := "form-check form-check-inline",
      inputPart,
      label(cls := "form-check-label text-light", `for` := labelValue, labelValue)
    ).render
  }

}