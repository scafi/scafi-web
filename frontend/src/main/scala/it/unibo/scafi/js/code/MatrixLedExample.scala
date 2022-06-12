package it.unibo.scafi.js.code

import it.unibo.scafi.js.code.MovementExamples.examples
import it.unibo.scafi.js.controller.local.DeviceConfiguration
import it.unibo.scafi.js.model.MatrixLed
import org.scalajs.dom.ext.Color

import scala.scalajs.js

object MatrixLedExample {
  val bigMatrix = DeviceConfiguration(Map("matrix" -> MatrixLed.fill(5, Color.White.toHex)))
  private val examples: Seq[Example] = Seq(
    Example.create("Turn on matrix with colors") {
      """//using Actuation
        |mux(mid().toInt < 50) { ledAll to "green" } { ledAll to "#FF00FF" }""".stripMargin
    },
    Example.create("Hsl colors") {
      """//using Actuation
        |val colors = 50
        |val color = rep(0)(c => (c + 1) % colors)
        |ledAll to hsl(color / colors.toDouble, 0.5, 0.5)""".stripMargin
    },
    Example.create("Color single led") {
      """//using Actuation
        |val firstRow = Seq(led(0,0) to "white", led(0,1) to "red", led(0,2) to "green")
        |val secondRow = Seq(led(1,0) to "#FF11AA", led(1,1) to "#F2F1A2", led(1,2) to "#F2AAAA")
        |val thirdRow = Seq(led(2,0) to hsl(0.9, 0.5, 0.5), led(2,1) to hsl(0.3, 0.5, 0.5), led(2,2) to hsl(0.2, 0.5, 0.5))
        |firstRow ++ secondRow ++ thirdRow""".stripMargin
    },
    Example.create("Shortcuts") {
      """//using Actuation
        |val id = mid().toInt
        |if (id < 10) {
        |  ledX to "red"
        |} else if (id < 20) {
        |  ledD to "white"
        |} else if (id < 30) {
        |  ledAD to "yellow"
        |} else if (id < 40) {
        |  ledCol(0) to hsl(0.2, 0.5, 0.5)
        |} else if (id < 50) {
        |  ledRow(1) to "green"
        |} else {
        |  ledAll to "cyan"
        |}""".stripMargin
    },
    Example.create("Sensor based colors", DeviceConfiguration.standard) {
      """//using Actuation
        |val sourceColor = mux(sense("source")) { "red" } { "white" }
        |val obstacleColor = mux(sense("obstacle")) { "green" } { "white" }
        |val targetColor = mux(sense("target")) { "yellow" } { "white" }
        |(ledCol(0) to sourceColor, ledCol(1) to obstacleColor, ledCol(2) to targetColor)""".stripMargin
    },
    Example.create("complex shape", bigMatrix) {
      """//using Actuation
        |val eyes = Seq(ledAll to "white", led(1,1) to off, led(1,3) to off)
        |val mouth = Seq(led(3,0) to off, led(3, 4) to off, led(4,1) to off, led(4,2) to off, led(4,3) to off)
        |eyes ++ mouth""".stripMargin
    }
  )
  def apply(): ExampleGroup = ExampleGroup("Matrix led", examples)
}
