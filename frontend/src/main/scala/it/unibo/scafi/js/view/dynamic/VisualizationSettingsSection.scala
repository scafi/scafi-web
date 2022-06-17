package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.SimulationSupport
import it.unibo.scafi.js.utils.GlobalStore
import it.unibo.scafi.js.view.HtmlRenderable
import it.unibo.scafi.js.view.static.VisualizationSetting
import org.scalajs.dom.html.Div
import org.scalajs.dom.raw.MouseEvent
import scalatags.JsDom.all._

import scala.scalajs.js

trait VisualizationSettingsSection {
  def idEnabled: Boolean

  def neighbourhoodEnabled: Boolean

  def sensorEnabled(name: String): Boolean

  def sensorsMenu: SensorsMenu
}

object VisualizationSettingsSection {

  def apply(settingDiv: Div, sensorsMenu: SensorsMenu, visualizationDropMenu: Div): VisualizationSettingsSection =
    new VisualizationSettingsSectionImpl(settingDiv, sensorsMenu, visualizationDropMenu)

  private class VisualizationSettingsSectionImpl(
      settingDiv: Div,
      override val sensorsMenu: SensorsMenu,
      visualizationDropMenu: Div
  ) extends VisualizationSettingsSection {
    private val labelsEnabledKey = new GlobalStore.Key {
      type Data = js.Dictionary[Boolean]
      override val value = "labelEnabled"
    }
    private val labels = GlobalStore.getOrElseUpdate(labelsEnabledKey)(
      js.Dictionary(
        "id" -> true,
        "neighborhood" -> true,
        SimulationSupport.EXPORT_LABEL -> true
      )
    )
    private val exportLabel = SimulationSupport.EXPORT_LABEL
    private val idEnabledSection = Toggle("id", check = labels("id"), onClick = e => onLabelChange(e, "id"))
    private val neighbourhoodSection =
      Toggle("neighborhood", check = labels("neighborhood"), onClick = e => onLabelChange(e, "neighborhood"))
    private val exportSection =
      Toggle(exportLabel, check = labels(exportLabel), onClick = e => onLabelChange(e, exportLabel))

    private val standardFontSize = 12
    private val minFontSize = 10
    private val maxFontSize = 20
    private val minNodeSize = 4
    private val maxNodeSize = 20
    private val standardNodeSize = 7
    private val initialConfig = GlobalStore.getOrElseUpdate(VisualizationSetting.key)(
      VisualizationSetting(standardFontSize, standardNodeSize)
    )
    private val fontSizeTag = NumericVizInput(
      "Font size",
      minFontSize,
      maxFontSize,
      initialConfig.fontSize,
      font => {
        val config = GlobalStore.get(VisualizationSetting.key).get
        GlobalStore.put(VisualizationSetting.key)(config.changeFont(font))
      }
    )
    private val nodeSizeTag = NumericVizInput(
      "Node size",
      minNodeSize,
      maxNodeSize,
      initialConfig.nodeSize,
      node => {
        val config = GlobalStore.get(VisualizationSetting.key).get
        GlobalStore.put(VisualizationSetting.key)(config.changeNode(node))
      }
    )

    List(exportSection.html, neighbourhoodSection.html, idEnabledSection.html).foreach { html =>
      html.classList.add("mr-2")
    }
    override def idEnabled: Boolean = idEnabledSection.enabled

    override def neighbourhoodEnabled: Boolean = neighbourhoodSection.enabled

    override def sensorEnabled(name: String): Boolean = name match {
      case "id" => idEnabledSection.enabled
      case SimulationSupport.EXPORT_LABEL => exportSection.enabled
      case "matrix" => true // enable by default
      case _ => false
    }

    visualizationDropMenu.appendChild(nodeSizeTag.html)
    visualizationDropMenu.appendChild(fontSizeTag.html)
    settingDiv.appendChild(idEnabledSection.html)
    settingDiv.appendChild(neighbourhoodSection.html)
    settingDiv.appendChild(exportSection.html)
    settingDiv.appendChild(sensorsMenu.html)

    private def onLabelChange(e: MouseEvent, name: String): Unit = {
      val labelsMap = GlobalStore.get(labelsEnabledKey).get
      labelsMap.put(name, !labelsMap(name))
      GlobalStore.put(labelsEnabledKey)(labelsMap)
      Toggle.Repaint(e)
    }
  }

  private case class NumericVizInput(
      labelValue: String,
      minValue: Int,
      maxValue: Int,
      initialValue: Int,
      onChange: (Int => Unit)
  ) extends HtmlRenderable[Div] {
    private val inputTag = input(
      `type` := "range",
      cls := "form-range",
      min := minValue,
      max := maxValue,
      value := initialValue,
      step := 2
    ).render
    /** @return the internal representation of the object under the html tag. */
    override lazy val html: Div = div(
      label(cls := "form-label", labelValue),
      inputTag
    ).render

    html.onchange = e => onChange(inputTag.value.toInt)
  }
}
