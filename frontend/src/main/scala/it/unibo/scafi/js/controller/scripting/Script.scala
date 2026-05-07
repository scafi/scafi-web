package it.unibo.scafi.js.controller.scripting

sealed trait Script

object Script {
  case class Scala(code: String) extends Script
  case class ScalaEasy(code: String) extends Script
}
