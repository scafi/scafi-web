package it.unibo.scafi.js.facade.phaser.types.core

import it.unibo.scafi.js.CleanableObject
/**
  * see @See [[https://photonstorm.github.io/phaser3-docs/Phaser.Types.Core.html#.FPSConfig]]
  */
class FPSConfig(val min : Int = 5,
               val target : Int = 60,
               val forceSetTimeOut : Boolean = false,
               val deltaHistory : Int = 10,
               val panicMax : Int = 120,
               val smoothStep : Boolean = true) extends CleanableObject
