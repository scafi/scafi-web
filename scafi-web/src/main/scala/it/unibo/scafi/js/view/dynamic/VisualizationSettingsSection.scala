package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.SupportConfiguration
import it.unibo.scafi.js.facade.simplebar.SimpleBar
import it.unibo.scafi.js.view.dynamic.VisualizationSettingsSection.CheckBox
import org.scalajs.dom.html.Div
import scalatags.JsDom.all._

import scala.scalajs.js
class VisualizationSettingsSection(settingDiv : Div, supportConfig : SupportConfiguration) {
  private val sensorSpan = span().render
  private var sensors : js.Dictionary[CheckBox] = js.Dictionary()
  EventBus.listen {
    case SupportConfiguration(_, _, device, _, _) => sensorSpan.textContent = ""
      sensors = device.sensors.map { case (name, value) => (name -> CheckBox(name))}
      sensors.foreach(checkbox => sensorSpan.appendChild(checkbox._2.html))
  }
  private val idEnabledSection = CheckBox("id")
  idEnabledSection.check
  def idEnabled : Boolean = idEnabledSection.enabled
  settingDiv.appendChild(idEnabledSection.html)
  settingDiv.appendChild(sensorSpan)
  new SimpleBar(settingDiv)
}
object VisualizationSettingsSection {
  private case class CheckBox(labelValue : String) {
    private val inputPart = input(cls := "form-check-input", tpe := "checkbox", id := labelValue).render
    def enabled : Boolean = inputPart.checked
    def check : Unit = inputPart.checked = true
    def uncheck : Unit = inputPart.checked = false
    val html = div(
      cls := "form-check form-check-inline",
      inputPart,
      label(cls := "form-check-label text-light", `for` := labelValue, labelValue)
    ).render
  }
}