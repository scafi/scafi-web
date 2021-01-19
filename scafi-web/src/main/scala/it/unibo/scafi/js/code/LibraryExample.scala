package it.unibo.scafi.js.code

import it.unibo.scafi.js.controller.local.DeviceConfiguration

import scala.scalajs.js

object LibraryExample {
  private val sourceSensor = DeviceConfiguration(js.Dictionary("source" -> false))
  private val examples : Seq[Example] = Seq(
    Example.create("Spread across the gradient", sourceSensor) {
      """//using StandardSensors, BlockG
        |G2(sense[Boolean]("source"))(0.0)(_ + nbrRange())(nbrRange)""".stripMargin
    },
    Example.create("Broadcast data", sourceSensor) {
      """//using StandardSensors, BlockG
        |broadcast(sense[Boolean]("source"), mid())""".stripMargin
    },
    Example.create("Channel", DeviceConfiguration.standard) {
      """//using StandardSensors, BlockG
        |def source : Boolean = sense("source")
        |def target : Boolean = sense("target")
        |def channel(source: Boolean, target: Boolean, width: Double): Boolean = {
        |  distanceTo(source) + distanceTo(target) <= distanceBetween(source, target) + width
        |}
        |val channelWidth = 1
        |channel(source, target, channelWidth)""".stripMargin
    },
    Example.create("Channel with obstacles", DeviceConfiguration.standard) {
      """//using StandardSensors, BlockG
        |def obstacle : Boolean = sense("obstacle")
        |def source : Boolean = sense("source")
        |def target : Boolean = sense("target")
        |def channel(source: Boolean, target: Boolean, width: Double): Boolean = {
        |  distanceTo(source) + distanceTo(target) <= distanceBetween(source, target) + width
        |}
        |val channelWidth = 1
        |branch(obstacle){ false }{ channel(source, target, channelWidth) }""".stripMargin
    },
    Example.create("Collect data", sourceSensor) {
      """//using StandardSensors, BlockG, BlockC
        |import scala.util.Random
        |val baseline = 10
        |def temperature : Double = Random.nextInt(20) + baseline
        |def source : Boolean = sense("source")
        |val potential = distanceTo(source)
        |val totalTemperature = C[Double,Double](potential, _+_, temperature, 0)
        |val count = C[Double, Double](potential, _ + _, 1.0, 0)
        |val avg = totalTemperature / count
        |mux[Any](source) { avg } { "" }""".stripMargin
    },
    Example.create("Collect and spread data", sourceSensor) {
      """//using StandardSensors, BlockG, BlockC
        |import scala.util.Random
        |val baseline = 10
        |val danger = 20
        |def temperature : Double = Random.nextInt(20) + baseline
        |def source : Boolean = sense("source")
        |val potential = distanceTo(source)
        |val totalTemperature = C[Double,Double](potential, _+_, temperature, 0)
        |val count = C[Double, Double](potential, _ + _, 1.0, 0)
        |val avg = totalTemperature / count
        |val state = mux(avg > danger) { "danger" } { "ok" }
        |broadcast(source, state)""".stripMargin
    },
    Example.create("Block S") {
        """// using BlockS, StandardSensors
        |val area = 200
        |S(area, nbrRange)
        |""".stripMargin
    }
  )
  def apply() : ExampleGroup = ExampleGroup("Libraries", examples)
}
