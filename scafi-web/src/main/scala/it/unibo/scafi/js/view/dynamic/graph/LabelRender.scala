package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.dsl.BasicWebIncarnation
import it.unibo.scafi.js.facade.phaser.Implicits._
import it.unibo.scafi.js.facade.phaser.Phaser.Scene
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.GameObject
import it.unibo.scafi.js.model.Node
import it.unibo.scafi.js.view.dynamic.graph.LabelRender._
import org.scalajs.dom.ext.Color
trait LabelRender extends ((Node, SensorEntry, Scene) => Output)

object LabelRender {
  type SensorEntry = Seq[(String, Any)]
  type Output = Seq[(GameObject, Seq[String])]
  type InputRender = (Node, SensorEntry, Scene)
  private case class LabelRenderImpl(function: ((Node, SensorEntry, Scene) => Output)) extends LabelRender {
    override def apply(v1: Node, v2: SensorEntry, v3: Scene): Output = function(v1, v2, v3)
  }

  def apply(function: (Node, SensorEntry, Scene) => Output) : LabelRender = LabelRenderImpl(function)

  def textify : LabelRender = {
    val fontSize = 9 //todo put in a global configuration object
    LabelRender {
      case (node, elements, scene) =>
        val result = elements
          .map { case (name, value) => normalizeValue(value) }
          .mkString("\n")
        val gameobject = scene.add.bitmapText(node.position.x, node.position.y, "font", normalizeValue(result), fontSize)
        Seq((gameobject, elements.map { case (name, value) => name}))
    }
  }

  def booleanRender : LabelRender = {
    val circleSize = 3 //todo put in configuration
    val deltaY = 7
    val deltaX = 5
    val falseAlpha = 0.2
    val colorMultiplier = 1000
    val initialColor : Int = Color.White
    val trueAlpha = 1
    val lineWidth = 1
    LabelRender {
      case (node, elements, scene) =>
        val result = elements.collect { case (name, value : Boolean) => name -> value }
        type FoldType = (Int, Seq[(GameObject, Seq[String])])
        result.foldLeft[FoldType](0, Seq.empty){
          case ((delta, result), (name, value)) =>
            val nodeColor = initialColor - (delta * colorMultiplier)
            val nodeAlpha = if(value) trueAlpha else falseAlpha
            val gameObject = scene.add.circle(node.position.x - deltaX, node.position.y + delta, circleSize, nodeColor, nodeAlpha)
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