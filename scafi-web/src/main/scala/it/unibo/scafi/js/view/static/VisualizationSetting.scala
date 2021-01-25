package it.unibo.scafi.js.view.static

import scala.scalajs.js

class VisualizationSetting(val fontSize : Int, val nodeSize : Int) extends js.Object {
  def changeFont(size : Int) : VisualizationSetting = new VisualizationSetting(size, nodeSize)
  def changeNode(size : Int) : VisualizationSetting = new VisualizationSetting(fontSize, size)
  val vizPatternMatch : Unit = {}
}
object VisualizationSetting {
  val globalName = "visualization-setting"
  def apply(fontSize : Int, nodeSize : Int) : VisualizationSetting = new VisualizationSetting(fontSize, nodeSize)
  def unapply(value : js.Object) : Option[(Int, Int)] = if(value.hasOwnProperty("vizPatternMatch")) {
    val res = value.asInstanceOf[VisualizationSetting]
    Some((res.fontSize, res.nodeSize))
  } else {
    None
  }
}
