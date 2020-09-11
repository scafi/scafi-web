package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.dsl.BasicWebIncarnation
import it.unibo.scafi.js.facade.phaser.Implicits._
import it.unibo.scafi.js.facade.phaser.Phaser.Scene
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.{GameObject, Text}
import it.unibo.scafi.js.facade.phaser.namespaces.display.ColorNamespace
import it.unibo.scafi.js.facade.phaser.types.gameobjects.text.{TextMetrics, TextStyle}
import it.unibo.scafi.js.facade.phaser.types.loader.XHRSettingsObject
import it.unibo.scafi.js.view.dynamic.graph.LabelRender.Output
import it.unibo.scafi.js.view.dynamic.graph.NodeRepresentation._
import org.scalajs.dom.ext.Color

object LabelRender {
  type SensorEntry = Seq[(String, Any)]
  type Output = Seq[(GameObject, Seq[String])]

  trait LabelRender extends ((GameobjectNode, SensorEntry, Scene) => Output) {
    def init : Scene => Unit
  }

  private case class LabelRenderImpl(logic : (GameobjectNode, SensorEntry, Scene) => Output, init : Scene => Unit = scene => {}) extends LabelRender {
    override def apply(v1: GameobjectNode, v2: SensorEntry, v3: Scene): Output = logic(v1, v2, v3)
  }

  def apply(function: (GameobjectNode, SensorEntry, Scene) => Output) : LabelRender = new LabelRenderImpl(function)

  implicit class RichLabelRender(labelRender: LabelRender) {
    def onInit(init : Scene => Unit) : LabelRender = LabelRenderImpl(labelRender, init)
  }
  def textify : LabelRender = {
    var textMap : Map[String, Text] = Map.empty
    LabelRender {
      case (node, elements, scene) =>
        val result = elements
          .map { case (name, value) => normalizeValue(value) }
          .mkString("\n")
        val gameobject = textMap.get(node.id)
          .map(_.setText(normalizeValue(result)))
          .map(_.setPosition(node.x, node.y))
          .getOrElse(scene.add.text(node.x, node.y, normalizeValue(result)))
        textMap += node.id -> gameobject
        gameobject.ignoreDestroy = true
        Seq((gameobject, elements.map { case (name, value) => name}))
    }
  }

  def textifyBitmap : LabelRender = {
    val fontSize = 9 //todo put in a global configuration object
    val textureUrl = "http://labs.phaser.io/assets/fonts/bitmap/atari-smooth.png"
    val fontUrl = "http://labs.phaser.io/assets/fonts/bitmap/atari-smooth.xml"
    LabelRender {
      case (node, elements, scene) =>
        val result = elements
          .map { case (name, value) => normalizeValue(value) }
          .mkString("\n")
        val gameobject = scene.add.bitmapText(node.x, node.y, "font", normalizeValue(result), fontSize)
        Seq((gameobject, elements.map { case (name, value) => name}))
    } onInit {
      scene => scene.load.bitmapFont("font", textureUrl, fontUrl)
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

  def gradientLike : LabelRender = {
    LabelRender {
      case (node, elements, scene) =>
        val label = "export"
        val circleSize = (node.width / 2)
        val result = elements.collect { case (`label`, e : BasicWebIncarnation#EXPORT) => e.root[Any]() }
          .collect { case e : Double => e }
        type FoldType = (Int, Seq[(GameObject, Seq[String])])
        result.flatMap {
          gradient =>
            val nodeColor = ColorNamespace.HSLToColor(gradient / 1920, 0.5, 0.5)
            val gameObject = scene.add.circle(node.x, node.y, circleSize, nodeColor.color)
            Seq(gameObject -> Seq(label))
        }
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