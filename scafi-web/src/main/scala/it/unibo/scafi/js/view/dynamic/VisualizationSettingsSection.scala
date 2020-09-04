package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.{SimulationSupport, SupportConfiguration}
import it.unibo.scafi.js.facade.simplebar.SimpleBar
import it.unibo.scafi.js.view.dynamic.PhaserGraphSection.ForceRepaint
import it.unibo.scafi.js.view.dynamic.VisualizationSettingsSection.CheckBox
import org.scalajs.dom.html.Div
import scalatags.JsDom.all._

import scala.scalajs.js
class VisualizationSettingsSection(settingDiv : Div) {
  private val sensorSpan = span().render
  private var sensors : js.Dictionary[CheckBox] = js.Dictionary()
  private val idEnabledSection = CheckBox("id")
  private val neighbourhoodSection = CheckBox("neighbourhood")
  idEnabledSection.check
  neighbourhoodSection.check
  def idEnabled : Boolean = idEnabledSection.enabled
  def neighbourhoodEnabled : Boolean = neighbourhoodSection.enabled
  def sensorEnabled(name : String) : Boolean = sensors.get(name).fold(false)(_.enabled)
    EventBus.listen {
    case SupportConfiguration(_, _, device, _, _) => sensorSpan.textContent = ""
      sensors = device.sensors.map { case (name, value) => (name -> CheckBox(name))}
      val exportCheckbox = CheckBox(SimulationSupport.EXPORT_LABEL)
      exportCheckbox.check
      sensors.put(SimulationSupport.EXPORT_LABEL, exportCheckbox)
      sensors.foreach(checkbox => sensorSpan.appendChild(checkbox._2.html))
  }
  settingDiv.appendChild(idEnabledSection.html)
  settingDiv.appendChild(sensorSpan)
  settingDiv.appendChild(neighbourhoodSection.html)
  new SimpleBar(settingDiv)
}
object VisualizationSettingsSection {
  private case class CheckBox(labelValue : String) {
    private val inputPart = input(cls := "form-check-input", tpe := "checkbox", id := labelValue).render
    inputPart.onclick = ev => EventBus.publish(ForceRepaint)
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