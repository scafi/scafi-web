package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.{DeviceConfiguration, SimulationSupport}
import org.scalajs.dom.html.Div

trait VisualizationSettingsSection {
  def idEnabled: Boolean

  def neighbourhoodEnabled: Boolean

  def sensorEnabled(name : String): Boolean

  def sensorsMenu: SensorsMenu
}

object VisualizationSettingsSection {

  def apply(settingDiv: Div, sensorsMenu: SensorsMenu /*= SensorsMenu()*/): VisualizationSettingsSection =
    new VisualizationSettingsSectionImpl(settingDiv, sensorsMenu)

  private class VisualizationSettingsSectionImpl(settingDiv: Div, override val sensorsMenu: SensorsMenu)
    extends VisualizationSettingsSection {
    private val idEnabledSection = Toggle("id", check = true, onClick = Toggle.Repaint)
    private val neighbourhoodSection = Toggle("neighborhood", check = true, onClick = Toggle.Repaint)
    private val exportSection = Toggle(SimulationSupport.EXPORT_LABEL, check = true, onClick = Toggle.Repaint)
    List(exportSection.html, neighbourhoodSection.html, idEnabledSection.html).foreach { html => html.classList.add("mr-2")}
    override def idEnabled: Boolean = idEnabledSection.enabled

    override def neighbourhoodEnabled: Boolean = neighbourhoodSection.enabled

    override def sensorEnabled(name : String): Boolean = name match {
      case "id" => idEnabledSection.enabled
      case SimulationSupport.EXPORT_LABEL => exportSection.enabled
      case "matrix" => true //enable by default
      case _ => false
    }

    idEnabledSection.check()
    neighbourhoodSection.check()
    settingDiv.appendChild(idEnabledSection.html)
    settingDiv.appendChild(neighbourhoodSection.html)
    settingDiv.appendChild(exportSection.html)

    settingDiv.appendChild(sensorsMenu.html)
  }
}
