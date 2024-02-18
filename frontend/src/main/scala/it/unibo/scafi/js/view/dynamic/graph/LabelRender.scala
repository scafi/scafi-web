package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.dsl.BasicWebIncarnation
import it.unibo.scafi.js.facade.phaser.Implicits._
import it.unibo.scafi.js.facade.phaser.Phaser.Scene
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.{BitmapText, GameObject, Shape, Text}
import it.unibo.scafi.js.facade.phaser.namespaces.display.ColorNamespace
import it.unibo.scafi.js.facade.phaser.types.gameobjects.text.TextStyle
import it.unibo.scafi.js.model.{ActuationData, Graph, MatrixLed}
import it.unibo.scafi.js.utils.{Debug, GlobalStore, JSNumber}
import it.unibo.scafi.js.view.dynamic.{PageBus, ThemeSwitcher}
import it.unibo.scafi.js.view.dynamic.graph.NodeRepresentation._
import it.unibo.scafi.js.view.dynamic.graph.PhaserGraphSection.ForceRepaint
import it.unibo.scafi.js.view.static.VisualizationSetting
import org.scalajs.dom.ext.Color

import scala.collection.mutable
import scala.scalajs.js
import scala.util.{Failure, Success, Try}

object LabelRender {
  type SensorEntries = Seq[(String, Any)]
  type Output = Seq[(GameObject, Seq[String])]

  trait LabelRender {
    def graphicalRepresentation(node: GameobjectNode, elements: SensorEntries, world: Graph, scene: Scene): Output
    def onInit(scene: Scene): Unit = {}
  }

  case class Textify() extends LabelRender {
    private var textCache: Map[String, Text] = Map.empty
    override def graphicalRepresentation(
        node: GameobjectNode,
        elements: SensorEntries,
        world: Graph,
        scene: Scene
    ): Output = {
      val result = elements
        .map { case (_, value) => normalizeValue(value) }
        .mkString("\n")
      val style =
        textCache.headOption.map { case (_, p) => new TextStyle(p.getTextMetrics()) }.getOrElse(new TextStyle())
      val gameobject = textCache
        .get(node.id)
        .map(_.setText(normalizeValue(result)))
        .map(_.setPosition(node.x, node.y))
        .getOrElse(scene.add.text(node.x, node.y, normalizeValue(result), style))
      textCache += node.id -> gameobject
      gameobject.ignoreDestroy = true
      Seq((gameobject, elements.map { case (name, value) => name }))
    }
  }

  case class TextifyBitmap(except: Set[String] = Set.empty) extends LabelRender {
    val fallBackSize = 12
    // todo put in a global configuration object
    // val textureUrl = "https://labs.phaser.io/assets/fonts/bitmap/atari-smooth.png"
    // val fontUrl = "https://labs.phaser.io/assets/fonts/bitmap/atari-smooth.xml"
    val textureUrl = "./fonts/font.png"
    val fontUrl = "./fonts/font.xml"
    val hexBasis = 16
    private val cache: mutable.Map[String, BitmapText] = new mutable.HashMap()
    var tint = Integer.parseInt(Color.White.toHex.tail, hexBasis)
    ThemeSwitcher.onDark { tint = Integer.parseInt(Color.White.toHex.tail, hexBasis); PageBus.publish(ForceRepaint) }
    ThemeSwitcher.onLight { tint = Integer.parseInt(Color.Black.toHex.tail, hexBasis); PageBus.publish(ForceRepaint) }

    override def graphicalRepresentation(
        node: GameobjectNode,
        elements: SensorEntries,
        world: Graph,
        scene: Scene
    ): Output = {
      val (fontSize, width) = GlobalStore.get(VisualizationSetting.key) match {
        case Success(VisualizationSetting(fontSize, nodeWidth)) => (fontSize, nodeWidth: JSNumber)
        case Failure(_) => (fallBackSize, node.width)
      }
      val textLabel = elements.filterNot { case (name, _) => except.contains(name) }
      val result = textLabel
        .map { case (name, value) => normalizeValue(value) }
        .mkString("\n")
      val text = cache.getOrElseUpdate(
        node.id,
        scene.add.bitmapText(node.x + node.width / 2, node.y, "fonts", normalizeValue(result), fontSize)
      )
      text.ignoreDestroy = true
      text.setTint(tint, tint, tint, tint)
      text.setFontSize(fontSize)
      text.setPosition(node.x + width / 2, node.y)
      text.setText(normalizeValue(result))
      Seq((text, textLabel.map { case (name, value) => name }))
    }
    override def onInit(scene: Scene): Unit = scene.load.bitmapFont("fonts", textureUrl, fontUrl)
  }

  case class BooleanRender() extends LabelRender {
    val falseAlpha = 0.2
    val colorMultiplier = 1000
    val initialColor: Int = Color.White
    val trueAlpha = 1
    val lineWidth = 1

    override def graphicalRepresentation(
        node: GameobjectNode,
        elements: SensorEntries,
        world: Graph,
        scene: Scene
    ): Output = {
      val circleSize = (node.width / 2).toInt
      val deltaY = circleSize * 2
      val deltaX = node.width
      val result = elements.collect { case (name, value: Boolean) => name -> value }
      type FoldType = (Int, Seq[(GameObject, Seq[String])])
      result
        .foldLeft[FoldType](0, Seq.empty) { case ((delta, result), (name, value)) =>
          val nodeColor = initialColor - (delta * colorMultiplier)
          val nodeAlpha = if (value) trueAlpha else falseAlpha
          val gameObject = scene.add.circle(node.x - deltaX, node.y + delta, circleSize, nodeColor, nodeAlpha)
          gameObject.setStrokeStyle(lineWidth, nodeColor)
          (delta + deltaY, result :+ (gameObject -> Seq(name)))
        }
        ._2
    }
  }

  case class BooleanExport() extends LabelRender {
    val falseExport = 0.3
    val trueExport = 1.0
    val strokeSize = 2

    override def graphicalRepresentation(
        node: GameobjectNode,
        elements: SensorEntries,
        world: Graph,
        scene: Scene
    ): Output = {
      val exp = elements
        .collect { case ("export", e: BasicWebIncarnation#EXPORT) => e }
        .map {
          _.root[Any]()
        }
        .collectFirst { case e: Boolean => e }
      exp match {
        case None => Seq.empty
        case Some(value) =>
          val exportValue = if (value) trueExport else falseExport
          val computedStrokeSize = if (value) strokeSize else 0
          val unsafeNode: Shape = node.asInstanceOf[Shape]
          unsafeNode.setFillStyle(unsafeNode.fillColor, alpha = exportValue)
          unsafeNode.setStrokeStyle(computedStrokeSize, Color.Cyan, 1)
          Seq((node: GameObject) -> Seq("export"))
      }
    }
  }

  case class GradientLike() extends LabelRender {
    override def graphicalRepresentation(
        node: GameobjectNode,
        elements: SensorEntries,
        world: Graph,
        scene: Scene
    ): Output = {
      val label = "export"
      val circleSize = node.width / 2
      val result = elements.collect { case (`label`, e: BasicWebIncarnation#EXPORT) => e.root[Any]() }.collect {
        case e: Double => e
      }
      type FoldType = (Int, Seq[(GameObject, Seq[String])])
      result.flatMap { gradient =>
        val nodeColor = ColorNamespace.HSLToColor(gradient / 1920, 0.5, 0.5)
        val gameObject = scene.add.circle(node.x, node.y, circleSize, nodeColor.color)
        Seq(gameObject -> Seq(label))
      }
    }
  }

  case class MatrixLedRender() extends LabelRender {
    val fallBackSize = 7.0
    private val cache = new mutable.HashMap[String, js.Dynamic]()
    override def graphicalRepresentation(
        node: GameobjectNode,
        elements: SensorEntries,
        world: Graph,
        scene: Scene
    ): Output = {
      val fullMatrix = GlobalStore.get(VisualizationSetting.key) match {
        case Success(VisualizationSetting(_, nodeSize)) => (nodeSize: Double)
        case Failure(_) => fallBackSize
      }
      val result = elements.collectFirst { case ("matrix", elem @ MatrixLed.MatrixMap(m, _)) => ("matrix", elem) }
      result match {
        case Some((label, matrix)) =>
          val matrixSize = fullMatrix / 2.0
          val elemSize = fullMatrix / matrix.dimension
          def delta(index: Int): Double = index * elemSize
          val result = cache.getOrElseUpdate(node.id, scene.add.asInstanceOf[js.Dynamic].graphics(0, 0))
          result.ignoreDestroy = true
          result.clear()
          val center = (node.x - matrixSize, node.y - matrixSize)
          for {
            i <- 0 until matrix.dimension
            j <- 0 until matrix.dimension
          } {
            val toPhaser = matrix.get(j, i).get.tail
            result.fillStyle(s"0x$toPhaser", 1)
            result.fillRect(center._1 + delta(i), center._2 + delta(j), elemSize, elemSize)
          }
          Seq(result.asInstanceOf[GameObject] -> Seq(label))
        case None => Seq.empty
      }
    }
  }

  def normalizeValue(any: Any): String = {
    val realValue = any match {
      case e: BasicWebIncarnation#EXPORT => removeActuationFrom(e.root[Any]())
      case other => other
    }
    realValue match {
      case value: Double => "%.2f".format(value)
      case value: Int => value.toString
      case value: String =>
        if (Try(value.toInt).isSuccess) {
          value
        } else if (Try(value.toDouble).isSuccess) {
          "%.2f".format(value.toDouble)
        } else {
          value
        }
      case other => other.toString
    }
  }

  private def removeActuationFrom(e: Any): String = e match {
    case e: ActuationData => ""
    case e: Iterable[_] => e.filterNot(_.isInstanceOf[ActuationData]).toString()
    case e: Product => e.productIterator.toList.filterNot(_.isInstanceOf[ActuationData]).mkString("(", ",", ")")
    case e: Any => e.toString
  }
}
