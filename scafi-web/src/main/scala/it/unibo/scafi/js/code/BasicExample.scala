package it.unibo.scafi.js.code

import it.unibo.scafi.js.controller.local.DeviceConfiguration

import scala.scalajs.js

object BasicExample {
  private def sense(sensor : String) = s"""sense[Boolean]("$sensor")"""
  private val oneSensor = DeviceConfiguration(js.Dictionary("sensor" -> false))
  private val twoSensor = DeviceConfiguration(js.Dictionary("sensor1" -> true, "sensor2" -> true))
  private val dollar = '$'
  private val examples = Seq(
    Example.create("Hello scafi", DeviceConfiguration.standard){ "\"hello scafi\"" },
    Example.create("Sum of fields"){ "1 + 2" },
    Example.create("Tuple field"){ "(10, 20)" },
    Example.create("Random"){
      """import scala.util.Random
        |Random.nextInt(100)
        |""".stripMargin},
    Example.create("Device id field") { "mid" },
    Example.create("Sense", oneSensor) { s"""${sense("sensor")}"""},
    Example.create("Mux and sense",  twoSensor) {
      s"""mux(sense[Boolean]("sensor1") && sense[Boolean]("sensor2")) {
         |  "hot"
         |} /*else*/ {
         |  "cold"
         |}""".stripMargin
    },
    Example.create("Neighbour count") { "foldhoodPlus(0)((a,b) => a + b)(nbr(1))" },
    Example.create("Field Evolution") { "rep(0){ _ + 1 }" },
    Example.create("Branching ", oneSensor) {
      s"""branch(${sense("sensor")}) {
         |  foldhood(0)((a,b) => a + b)(nbr(1))
         |} {
         |  0
         |}""".stripMargin},
    Example.create("Neighbour range field") {
      s"""//using StandardSensors
         |(minHood{nbrRange}, f"$dollar{minHoodPlus{nbrRange}}%.2g")
         |""".stripMargin
    },
    Example.create("Function reuse", oneSensor) {
      """def sense1() = sense[Boolean]("sensor")
        |foldhood(0)(_+_)(if(nbr{sense1}) 1 else 0)""".stripMargin
    },
    Example.create("Gradient", oneSensor) {
      s"""//using StandardSensors
         |rep(Double.PositiveInfinity)(distance =>
         |  mux(sense[Boolean]("sensor")){
         |    0.0
         |  }{
         |    minHoodPlus(nbr{distance} + nbrRange)
         |  }
         |).formatted("%4.2g")""".stripMargin
    },
  )
  def apply() : ExampleGroup = ExampleGroup("Basic", examples)
}
