package it.unibo.scafi.js.controller.scripting

import it.unibo.scafi.incarnations.Incarnation

sealed trait Script
case class Javascript(code : String) extends Script
case class Scala(code : String) extends Script
case class ScaFi[P <: Incarnation#AggregateProgram](program : P) extends Script

object Script {
  /**
    * return a script with javascript lang selected
    */
  def javascript(code : String) : Script = Javascript(code)
}
