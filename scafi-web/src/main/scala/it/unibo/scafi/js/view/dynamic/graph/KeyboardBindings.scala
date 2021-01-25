package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.controller.local.SimulationCommand.ToggleSensor
import it.unibo.scafi.js.controller.local.SupportConfiguration
import it.unibo.scafi.js.facade.phaser.Phaser.Scene
import it.unibo.scafi.js.facade.phaser.namespaces.EventsNamespace.Handler1
import it.unibo.scafi.js.facade.phaser.namespaces.input.KeyboardNamespace.Events.DOWN
import it.unibo.scafi.js.facade.phaser.namespaces.input.KeyboardNamespace.KeyCodes._
import it.unibo.scafi.js.utils.{Nullable, _}
import it.unibo.scafi.js.view.dynamic.PageBus

class KeyboardBindings(interaction: Interaction) {
  private var sensors: Seq[String] = Seq()
//  private val keys = List(ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE)
  var scene: Nullable[Scene] = _

  PageBus.listen {
    case SupportConfiguration(_, _, deviceShape, _, _) =>
      sensors = deviceShape
        .sensors
        .filter {
          case (_, _: Boolean) => true
          case _ => false
        }
        .map { case (name, _) => name }.toSeq
//      initSensorKeys()
  }

  def init(scene: Scene): Unit = {
    this.scene = scene
//    initSensorKeys()
  }

//  private def initSensorKeys(): Unit = {
//    this.scene.foreach(scene => {
//      keys.foreach(scene.input.keyboard.get.removeKey(_, destroy = true))
//      keys
//        .zip(sensors)
//        .map { case (key, name) => name -> scene.input.keyboard.get.addKey(key) }
//        .foreach { case (sensor, key) => key.on(DOWN, getToggleSensorHandler(sensor)) }
//    })
//  }

  private def getToggleSensorHandler(sensor: String): Handler1[Scene] = (_, _) => {
    val ids = interaction.selection.map(_.toSet).getOrElse(Set())
    interaction.commandInterpreter.execute(ToggleSensor(sensor, ids))
  }
}
