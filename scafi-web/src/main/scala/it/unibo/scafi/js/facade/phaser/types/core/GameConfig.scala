package it.unibo.scafi.js.facade.phaser.types.core

import it.unibo.scafi.js.facade.phaser.Phaser
import it.unibo.scafi.js.facade.phaser.types.scenes.SceneSetting
import it.unibo.scafi.js.{CleanableObject, Nullable}
import org.scalajs.dom.raw.{CanvasRenderingContext2D, HTMLCanvasElement, HTMLElement}

import scala.scalajs.js
import scala.scalajs.js.|

/**
  * @see{https://photonstorm.github.io/phaser3-docs/Phaser.Types.Core.html#.GameConfig}
  */
//TODO comple
class GameConfig(val scene : SceneSetting,
                 val parent: js.UndefOr[String | HTMLElement],
                 val width: Int = 800,
                 val height: Int = 600,
                 val zoom : Int = 1,
                 val resolution : Int = 1,
                 val `type` : Int = Phaser.AUTO,
                 val canvas : js.UndefOr[Nullable[HTMLCanvasElement]] = null,
                 val canvasStyle : js.UndefOr[Nullable[String]] = null,
                 val customEnvironment : Boolean = false,
                 val transparent: Boolean = false,
                 val context : js.UndefOr[CanvasRenderingContext2D] = js.undefined,
                 val seed : js.UndefOr[js.Array[String]] = js.undefined,
                 val title : String = "",
                 val url : js.UndefOr[String] = js.undefined,
                 val autoFocus : Boolean = true,
                 val disableContextMenu : Boolean = false,
                 val fps : js.UndefOr[FPSConfig] = js.undefined,
                 val background : String | Int = 0x000000,
                 val physics : js.UndefOr[PhysicsConfig] = js.undefined,
                 val scale : js.UndefOr[ScaleConfig] = js.undefined,
                 val plugins : js.UndefOr[PluginObject | js.Array[PluginObjectItem]] = {}) extends CleanableObject
