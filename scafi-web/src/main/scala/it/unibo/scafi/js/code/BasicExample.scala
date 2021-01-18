package it.unibo.scafi.js.code

import it.unibo.scafi.js.controller.local.DeviceConfiguration

import scala.scalajs.js

object BasicExample {
  private def sense(sensor : String) = s"""sense[Boolean]("$sensor")"""
  private val none = DeviceConfiguration.none
  private val sensors = DeviceConfiguration(js.Dictionary("sensor" -> true))
  private val examples = Seq(
    Example.create("hello scafi", DeviceConfiguration.standard){ "\"hello scafi\"" },
    Example.create("rep") { "rep(0)(_ + 1)" },
    Example.create("sense", sensors) { s"""${sense("sensor")}"""},
    Example.create("mux",  sensors) { s"""mux(${sense("sensor")}) { 0 } { 1 }""" },
    Example.create("foldhood + nbr") { "foldhood(0)((a,b) => a + b)(nbr(1))" },
    Example.create("mid") { "mid()" },
    Example.create("branch", sensors) {
      s"""branch(${sense("sensor")}) {
         |  foldhood(0)((a,b) => a + b)(nbr(1))
         |} {
         |  0
         |}""".stripMargin}
  )
  def apply() : ExampleGroup = ExampleGroup("Basic", examples)
}
