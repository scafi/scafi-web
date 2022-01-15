package it.unibo.scafi.js.controller.scripting

import it.unibo.scafi.incarnations.Incarnation

sealed trait Script

object Script {
  case class Javascript(code: String) extends Script
  case class Scala(code: String) extends Script
  case class ScalaEasy(code: String) extends Script // todo think if it is to remove
  case class ScaFi[P <: Incarnation#AggregateProgram](program: P) extends Script
  /** return a script with javascript lang selected */
  def javascript(code: String): Script = Javascript(code)
}
