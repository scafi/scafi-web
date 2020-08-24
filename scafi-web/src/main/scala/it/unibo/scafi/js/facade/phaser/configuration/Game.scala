package it.unibo.scafi.js.facade.phaser.configuration

import it.unibo.scafi.js.facade.phaser.Phaser
import org.scalajs.dom.raw.{CanvasRenderingContext2D, HTMLCanvasElement, HTMLElement}

import scala.scalajs.js
import scala.scalajs.js.|

object Game {
  /**
   * @see{https://photonstorm.github.io/phaser3-docs/Phaser.Types.Core.html#.GameConfig}
   */
  class Config(val scene : Scene.HandlerConfiguration, //TODO add multi scene possibility
               val parent: String | HTMLElement,
               val width: Int = 800,
               val height: Int = 600,
               val zoom : Int = 1,
               val resolution : Int = 1,
               val `type` : Int = Phaser.AUTO,
               val canvas : js.UndefOr[HTMLCanvasElement] = {},
               val canvasStyle : js.UndefOr[String] = {},
               val customEnvironment : Boolean = false,
               val transparent: Boolean = false,
               val context : js.UndefOr[CanvasRenderingContext2D] = {},
               val seed : js.UndefOr[js.Array[String]] = {},
               val title : String = "",
               val autoFocus : Boolean = true,
               val disableContextMenu : Boolean = false,
               val fps : js.UndefOr[Fps.Config] = {},
               val background : String | Int = 0x000000,
               val plugins : js.UndefOr[Plugin.ObjectItem | js.Array[Plugin.ObjectItem]] = {})extends js.Object
}
