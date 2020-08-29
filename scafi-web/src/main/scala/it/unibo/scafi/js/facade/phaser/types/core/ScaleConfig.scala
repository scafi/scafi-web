package it.unibo.scafi.js.facade.phaser.types.core

import it.unibo.scafi.js.{CleanableObject, Nullable}
import it.unibo.scafi.js.facade.phaser.Phaser.Scale._
import org.scalajs.dom.raw.HTMLElement

import scala.scalajs.js
import scala.scalajs.js.|
/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Types.Core.html#.ScaleConfig]] */
class ScaleConfig(val width : Int = 1024,
                  val height : Int = 768,
                  val zoom : Int | ZoomValue = 1,
                  val resolution : Int = 1,
                  val parent : js.UndefOr[Nullable[HTMLElement]] = js.undefined,
                  val expandParent : Boolean = true,
                  val min : js.UndefOr[Int] = js.undefined,
                  val max : js.UndefOr[Int] = js.undefined,
                  val mode : ScaleModeValue = ScaleModes.NONE,
                  val autoRound : Boolean = false,
                  val autoCenter : CenterValue = Center.NO_CENTER,
                  val resizeInterval : Int = 500,
                  val fullscreenTarget : js.UndefOr[Nullable[HTMLElement]] = js.undefined
                 ) extends CleanableObject
