package it.unibo.scafi.js.code

import it.unibo.scafi.js.controller.local.DeviceConfiguration

case class Example(name : String, body : String, devices : DeviceConfiguration)

object Example {
  def create(name : String,devices : DeviceConfiguration = DeviceConfiguration.none)(body : String) : Example = {
    Example(name, body, devices)
  }
}