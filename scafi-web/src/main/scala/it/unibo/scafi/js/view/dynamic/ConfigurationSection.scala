package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.code.Example
import it.unibo.scafi.js.controller.AggregateSystemSupport
import it.unibo.scafi.js.controller.local._
import it.unibo.scafi.js.facade.simplebar.SimpleBar
import org.scalajs.dom.html.{Button, Div, Select}
import org.scalajs.dom.raw.MouseEvent

import scala.scalajs.js
import scala.util.{Failure, Success, Try}
import ConfigurationSection._
import it.unibo.scafi.js.utils.{Debug, Execution}
import scalatags.JsDom.all._

class ConfigurationSection(configuration : Div, support : AggregateSystemSupport[_, SupportConfiguration, _]) {
  private val container : Div = div(cls:= "pt-1, pb-1").render
  private val selectMode = select (cls := "form-control", option(Random.toString), option(Grid.toString)).render
  private val loadButton = button( cls := "btn btn-primary btn-sm ml-1 mr-1",`type` := "button", "load config").render
  private val mainDiv = div(cls := "input-group input-group-sm pt-1", selectMode, loadButton).render
  private val (cols, rows, stepX, stepY, tolerance) = (InputText("cols", 10), InputText("rows", 10), InputText("stepX", 60), InputText("stepY", 60), InputText("tolerance", 0))
  private val gridValue = List(cols, rows, stepX, stepY, tolerance)
  private val (min, max, howMany) = (InputText("min", 0), InputText("max", 500), InputText("howMany", 100))
  private val randomValue = List(min, max, howMany)
  private val radius = InputText("radius", 70)
  private val addSensorButton = button( cls := "btn btn-primary btn-sm",`type` := "button", "add sensor").render
  private var sensors : List[SensorInputText] = List()
  private var lastConfiguration : SupportConfiguration = _

  selectMode.onchange = _ => init(getModeFromSelect(selectMode))
  loadButton.onclick = _ => load(getModeFromSelect(selectMode))
  configuration.appendChild(container)
  SimpleBar.wrap(configuration)
  sensors.foreach(sensor => sensor.closeButton.onclick = onRemoveSensor(sensor))
  addSensorButton.onclick = ev => {
    val newElement = new SensorInputText()
    newElement.closeButton.onclick = onRemoveSensor(newElement)
    sensors = sensors ::: List(newElement)
    container.appendChild(newElement.render)
  }
  init(Random)
  var elements : js.Array[Any] = js.Array()
  Debug("elments", elements)
  EventBus.listen {
    case config : SupportConfiguration => lastConfiguration = config
      configureFromConfig(config)
  }

  def updateDeviceShape(shape : DeviceConfiguration) : Unit = {
    lastConfiguration.copy(deviceShape = shape)
    evolve(lastConfiguration.copy(deviceShape = shape))
  }
  private def onRemoveSensor(sensor : SensorInputText) : MouseEvent => Unit = ev => {
    sensors = sensors.filterNot(_ == sensor)
    init(getModeFromSelect(selectMode))
  }

  private def init(mode : Mode) : Unit = {
    container.textContent = ""
    container.appendChild(mainDiv)
    val elements = mode match {
      case Grid => gridValue
      case Random => randomValue
    }

    elements foreach { (input) => container.appendChild(input.render) }
    container.appendChild(radius.render)
    container.appendChild(addSensorButton)
    sensors foreach { input => container.appendChild(input.render) }
  }

  private def load(mode : Mode) : Unit = {
    val netSettings = mode match {
      case Grid => GridLikeNetwork(rows.intValue, cols.intValue, stepX.intValue, stepY.intValue, tolerance.intValue)
      case Random => RandomNetwork(min.intValue, max.intValue, howMany.intValue)
    }
    val sensorMap = js.Dictionary[Any](sensors.map(_.nameAndValue):_*)
    val configuration = SupportConfiguration(netSettings, SpatialRadius(radius.intValue), DeviceConfiguration(sensorMap), SimulationSeeds())
    evolve(configuration)
  }

  private def configureFromConfig(conf : SupportConfiguration) : Unit = {
    sensors = conf.deviceShape.sensors.map { case (k, v) => new SensorInputText(k, v.toString) }.toList
    conf.network match {
      case GridLikeNetwork(_rows, _cols, _stepX, _stepY, _tollerance) => rows.intValue = _rows
        cols.intValue = _cols
        stepX.intValue = _stepX.toInt
        stepY.intValue = _stepY.toInt
        tolerance.intValue = _tollerance.toInt
        selectMode.value = Grid.toString
      case RandomNetwork(_min, _max, _howMany) => min.intValue = _min.toInt
        max.intValue = _max.toInt
        howMany.intValue = _howMany
        selectMode.value = Random.toString
    }
    init(getModeFromSelect(selectMode))
    conf.neighbour match {
      case SpatialRadius(range) => radius.intValue = range.toInt
    }
  }

  private def evolve(config : SupportConfiguration) : Unit = {
    support.evolve(config)
    EventBus.publish(config)
  }
}

object ConfigurationSection {
  import scalatags.JsDom.all._
  private class SensorInputText(name : String = "", default : String = "") {
    private val nameTag = input (`type` := "text", placeholder := "name", cls := "form-control mr-1", value := name).render
    private val valueTag = input (`type` := "text", placeholder := "value", cls := "form-control", value := default).render
    val closeButton : Button = button(cls := "btn-sm btn-danger ml-1", span(cls := "text-light", "X")).render
    private def booleanFromString(value : String) : Try[Boolean] = value match {
      case "true" => Success(true)
      case "false" => Success(false)
      case _ => Failure(new IllegalArgumentException)
    }

    def nameAndValue : (String, Any) = (nameTag.value, parseValue)

    def parseValue : Any = Try(valueTag.value.toInt)
      .recoverWith { case _ => Try(valueTag.value.toDouble) }
      .recoverWith { case _ => (booleanFromString(valueTag.value)) }
      .getOrElse(valueTag.value)
    val render =  div (
      cls := "input-group-sm mb-2 mt-2",
      div(cls := "input-group-prepend", nameTag, valueTag, closeButton),
    ).render
  }

  private case class InputText(label : String, defaultValue : Int) {
    private val inputSection = input(`type` := "number", cls := "form-control", value := defaultValue).render
    def intValue : Int = inputSection.value.toInt
    def intValue_=(value : Int) : Unit = inputSection.value = value.toString
    val render = div (
      cls := "input-group input-group-sm mb-2 mt-2",
      div(cls := "input-group-prepend", span (cls := "input-group-text", label)),
      inputSection
    ).render
  }

  private trait Mode
  private case object Random extends Mode { override def toString: String = "random" }
  private case object Grid extends Mode { override def toString: String = "grid" }

  private def modeFromString(mode : String) : Mode = mode match {
    case "random" => Random
    case "grid" => Grid
  }

  private def getModeFromSelect(select : Select) : Mode = {
    val option = select.selectedIndex
    modeFromString(select.children.item(option).textContent)
  }
}
