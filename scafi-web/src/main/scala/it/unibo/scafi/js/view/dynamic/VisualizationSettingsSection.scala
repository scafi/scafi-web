package it.unibo.scafi.js.view.dynamic

import org.scalajs.dom.html.Div

trait VisualizationSettingsSection {
  def idEnabled: Boolean

  def neighbourhoodEnabled: Boolean

  def anyLabelEnabled: Boolean

  def sensorsMenu: SensorsMenu
}

object VisualizationSettingsSection {

  def apply(settingDiv: Div, sensorsMenu: SensorsMenu = SensorsMenu()): VisualizationSettingsSection =
    new VisualizationSettingsSectionImpl(settingDiv, sensorsMenu)

  private class VisualizationSettingsSectionImpl(settingDiv: Div, override val sensorsMenu: SensorsMenu)
    extends VisualizationSettingsSection {
    private val idEnabledSection = new CheckBox("id")
    private val neighbourhoodSection = new CheckBox("neighborhood")

    override def idEnabled: Boolean = idEnabledSection.enabled

    override def neighbourhoodEnabled: Boolean = neighbourhoodSection.enabled

    override def anyLabelEnabled: Boolean = sensorsMenu.sensorsEnabled || idEnabled

    idEnabledSection.check()
    neighbourhoodSection.check()
    settingDiv.appendChild(idEnabledSection.html)
    settingDiv.appendChild(neighbourhoodSection.html)
    settingDiv.appendChild(sensorsMenu.html)
//    new SimpleBar(settingDiv)
//    if (!$(s"#${settingDiv.id} .simplebar-content").hasClass("form-inline")) {
//      $(s"#${settingDiv.id} .simplebar-content").addClass("form-inline")
//    }
  }

}
