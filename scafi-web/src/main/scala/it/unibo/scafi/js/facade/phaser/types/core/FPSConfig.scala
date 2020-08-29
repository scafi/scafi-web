package it.unibo.scafi.js.facade.phaser.types.core

import it.unibo.scafi.js.CleanableObject

class FPSConfig(val min : Int = 5,
               val target : Int = 60,
               val forceSetTimeOut : Boolean = false,
               val deltaHistory : Int = 10,
               val panicMax : Int = 120,
               val smoothStep : Boolean = true) extends CleanableObject
