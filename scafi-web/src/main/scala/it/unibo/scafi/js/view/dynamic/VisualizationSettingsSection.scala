package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.SimulationSupport
import it.unibo.scafi.js.utils.GlobalStore
import it.unibo.scafi.js.view.HtmlRenderable
import it.unibo.scafi.js.view.static.VisualizationSetting
import org.scalajs.dom.{VisibilityState, document}
import org.scalajs.dom.html.Div
import scalatags.JsDom.all._

trait VisualizationSettingsSection {
  def idEnabled: Boolean

  def neighbourhoodEnabled: Boolean

  def sensorEnabled(name : String): Boolean

  def sensorsMenu: SensorsMenu
}

object VisualizationSettingsSection {

  def apply(settingDiv: Div, sensorsMenu: SensorsMenu, visualizationDropId : String): VisualizationSettingsSection =
    new VisualizationSettingsSectionImpl(settingDiv, sensorsMenu, visualizationDropId)

  private class VisualizationSettingsSectionImpl(settingDiv: Div, override val sensorsMenu: SensorsMenu, visualizationDropId : String)
    extends VisualizationSettingsSection {
    private val idEnabledSection = Toggle("id", check = true, onClick = Toggle.Repaint)
    private val neighbourhoodSection = Toggle("neighborhood", check = true, onClick = Toggle.Repaint)
    private val exportSection = Toggle(SimulationSupport.EXPORT_LABEL, check = true, onClick = Toggle.Repaint)
    private val standardFontSize = 12
    private val minFontSize = 10
    private val maxFontSize = 20
    private val minNodeSize = 4
    private val maxNodeSize = 20
    private val standardNodeSize = 7
    val initialConfig = GlobalStore.getOrElseUpdate(VisualizationSetting.globalName, VisualizationSetting(standardFontSize, standardNodeSize))
    private val fontSizeTag = NumericVizInput("Font size", minFontSize, maxFontSize, standardFontSize, font => {
      val config = GlobalStore.get[VisualizationSetting](VisualizationSetting.globalName).get
      GlobalStore.put(VisualizationSetting.globalName, config.changeFont(font))
    })
    private val nodeSizeTag = NumericVizInput("Node size", minNodeSize, maxNodeSize, standardNodeSize, node => {
      val config = GlobalStore.get[VisualizationSetting](VisualizationSetting.globalName).get
      GlobalStore.put(VisualizationSetting.globalName, config.changeNode(node))
    })

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
    document.getElementById(visualizationDropId).appendChild(nodeSizeTag.html)
    document.getElementById(visualizationDropId).appendChild(fontSizeTag.html)
    settingDiv.appendChild(idEnabledSection.html)
    settingDiv.appendChild(neighbourhoodSection.html)
    settingDiv.appendChild(exportSection.html)
    settingDiv.appendChild(sensorsMenu.html)
  }

  private case class NumericVizInput(labelValue : String, minValue : Int,
                                     maxValue : Int, initialValue : Int,
                                     onChange : (Int => Unit)) extends HtmlRenderable[Div] {
    private val inputTag = input(
      `type` := "range", cls := "form-range", min := minValue, max := maxValue, value := initialValue, step := 2
    ).render
    /**
     * @return the internal representation of the object under the html tag.
     */
    override lazy val html: Div = div(
      label(cls := "form-label", labelValue),
      inputTag
    ).render

    html.onchange = e => onChange(inputTag.value.toInt)
  }
}
