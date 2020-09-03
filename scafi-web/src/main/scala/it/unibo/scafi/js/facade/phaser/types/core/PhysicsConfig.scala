package it.unibo.scafi.js.facade.phaser.types.core

import it.unibo.scafi.js.CleanableObject
import it.unibo.scafi.js.facade.phaser.types.physics.arcade.ArcadeWorldConfig
import it.unibo.scafi.js.facade.phaser.types.physics.matter.MatterWorldConfig

import scala.scalajs.js

class PhysicsConfig(val default : String,
                    val arcade : js.UndefOr[ArcadeWorldConfig] = js.undefined,
                    val matter : js.UndefOr[MatterWorldConfig] = js.undefined
                   ) extends CleanableObject {
  clean()
}

object PhysicsConfig {
  val ARCADE : String = "arcade"
  val IMPACT : String = "impact"
  val MATTER : String = "matter"
}