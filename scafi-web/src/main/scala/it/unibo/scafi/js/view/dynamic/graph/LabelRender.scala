package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.dsl.BasicWebIncarnation
import it.unibo.scafi.js.facade.phaser.Implicits._
import it.unibo.scafi.js.facade.phaser.Phaser.Scene
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.GameObject
import it.unibo.scafi.js.model.Node
import org.scalajs.dom.ext.Color
import NodeRepresentation._
object LabelRender {
  type SensorEntry = Seq[(String, Any)]
  type Output = Seq[(GameObject, Seq[String])]
  type LabelRender = (GameobjectNode, SensorEntry, Scene) => Output


  def apply(function: LabelRender) : LabelRender = function

  def textify : LabelRender = {
    val fontSize = 9 //todo put in a global configuration object
    LabelRender {
      case (node, elements, scene) =>
        val result = elements
          .map { case (name, value) => normalizeValue(value) }
          .mkString("\n")
        val gameobject = scene.add.bitmapText(node.x, node.y, "font", normalizeValue(result), fontSize)
        Seq((gameobject, elements.map { case (name, value) => name}))
    }
  }

  def booleanRender : LabelRender = {
    val falseAlpha = 0.2
    val colorMultiplier = 1000
    val initialColor : Int = Color.White
    val trueAlpha = 1
    val lineWidth = 1
    LabelRender {
      case (node, elements, scene) =>
        val circleSize = (node.width / 3).toInt
        val deltaY = circleSize * 2 + 1
        val deltaX = node.width / 2
        val result = elements.collect { case (name, value : Boolean) => name -> value }
        type FoldType = (Int, Seq[(GameObject, Seq[String])])
        result.foldLeft[FoldType](0, Seq.empty){
          case ((delta, result), (name, value)) =>
            val nodeColor = initialColor - (delta * colorMultiplier)
            val nodeAlpha = if(value) trueAlpha else falseAlpha
            val gameObject = scene.add.circle(node.x - deltaX, node.y + delta, circleSize, nodeColor, nodeAlpha)
            gameObject.setStrokeStyle(lineWidth, nodeColor)
            (delta + deltaY, result :+ (gameObject -> Seq(name)))
        }._2
    }
  }

  def normalizeValue(any : Any) : String = {
    val realValue = any match {
      case e : BasicWebIncarnation#EXPORT => e.root[Any]()
      case other => other
    }
    realValue match {
      case value : Int => value.toString
      case value : Double => "%.2f".format(value)
      case other => other.toString
    }
  }
}