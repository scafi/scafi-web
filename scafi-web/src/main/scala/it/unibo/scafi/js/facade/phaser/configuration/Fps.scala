package it.unibo.scafi.js.facade.phaser.configuration

import scala.scalajs.js

object Fps {
  class Config(val min : Int = 5,
               val target : Int = 60,
               val forceSetTimeOut : Boolean = false,
               val deltaHistory : Int = 10,
               val panicMax : Int = 120,
               val smoothStep : Boolean = true) extends js.Object
}
