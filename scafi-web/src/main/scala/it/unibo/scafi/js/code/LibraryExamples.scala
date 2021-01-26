package it.unibo.scafi.js.code

import it.unibo.scafi.js.controller.local.DeviceConfiguration
import it.unibo.scafi.js.utils.GlobalStore

import scala.scalajs.js

object LibraryExamples {
  private val sourceSensor = DeviceConfiguration(js.Dictionary("source" -> false, "matrix" -> DeviceConfiguration.standardMatrix))
  private val sourceTarget = Seq("1" -> js.Dictionary("source" -> (true : Any)), "100" -> js.Dictionary("target"-> (true : Any)))
  private val channel = DeviceConfiguration(DeviceConfiguration.standard.sensors,
    js.Dictionary(sourceTarget:_*)
  )
  private val initialValues : Seq[(String, js.Dictionary[Any])] = (40 until 45) map { id => id.toString -> js.Dictionary("obstacle" -> (true : Any)) }
  private val channelWithObstacle = DeviceConfiguration(DeviceConfiguration.standard.sensors, js.Dictionary((initialValues ++ sourceTarget):_*))

  private val examples : Seq[Example] = Seq(
    Example.create("Spread across the gradient", sourceSensor) {
      """//using StandardSensors, BlockG
        |G2(sense[Boolean]("source"))(0.0)(_ + nbrRange())(nbrRange)""".stripMargin
    },
    Example.create("Broadcast data", sourceSensor) {
      """//using StandardSensors, BlockG
        |broadcast(sense[Boolean]("source"), mid())""".stripMargin
    },
    Example.create("Channel", channel) {
      """//using StandardSensors, BlockG, Actuation
        |def source : Boolean = sense("source")
        |def target : Boolean = sense("target")
        |def channel(source: Boolean, target: Boolean, width: Double): Boolean = {
        |  distanceTo(source) + distanceTo(target) <= distanceBetween(source, target) + width
        |}
        |val channelWidth = 1
        |val inChannel = channel(source, target, channelWidth)
        |val channelColor = mux(inChannel) { ledAll to "white" } { ledAll to off }
        |val nodeColor = mux(source) { ledAll to "blue" } {
        |  mux(target) { ledAll to "green" } { channelColor }
        |}
        |
        |(inChannel, nodeColor)""".stripMargin
    },
    Example.create("Channel with obstacles", channelWithObstacle) {
      """//using StandardSensors, BlockG, Actuation
        |def obstacle : Boolean = sense("obstacle")
        |def source : Boolean = sense("source")
        |def target : Boolean = sense("target")
        |def channel(source: Boolean, target: Boolean, width: Double): Boolean = {
        |  distanceTo(source) + distanceTo(target) <= distanceBetween(source, target) + width
        |}
        |val channelWidth = 1
        |
        |val inChannel = branch(obstacle){ false }{ channel(source, target, channelWidth) }
        |val channelColor = mux(inChannel) { ledAll to "white" } { ledAll to off }
        |val nodeColor = mux(source) { ledAll to "blue" } {
        |  mux(target) { ledAll to "green" } {
        |    mux(obstacle) {ledAll to "red" } { channelColor }
        |  }
        |}
        |
        |(inChannel, nodeColor)""".stripMargin
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
        """// using BlockS, StandardSensors, Actuation
          |val area = 200
          |val leader = S(area, nbrRange)
          |(leader, mux(leader) { ledAll to "red" } { ledAll to "white" })""".stripMargin
    }
  )
  def apply() : ExampleGroup = ExampleGroup("Libraries", examples)
}
