package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.dsl.BasicWebIncarnation
import it.unibo.scafi.js.facade.phaser.Implicits._
import it.unibo.scafi.js.facade.phaser.Phaser.Scene
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.{BitmapText, GameObject, Rectangle, Shape, Text}
import it.unibo.scafi.js.facade.phaser.namespaces.display.ColorNamespace
import it.unibo.scafi.js.facade.phaser.types.gameobjects.text.{TextMetrics, TextStyle}
import it.unibo.scafi.js.model.{ActuationData, Graph, MatrixLed}
import it.unibo.scafi.js.view.dynamic.graph.NodeRepresentation._
import org.scalajs.dom.ext.Color
import org.scalajs.dom.window

import scala.collection.mutable

object LabelRender {
  type SensorEntries = Seq[(String, Any)]
  type Output = Seq[(GameObject, Seq[String])]

  trait LabelRender {
    def graphicalRepresentation(node : GameobjectNode, elements : SensorEntries, world : Graph, scene : Scene) : Output
    def onInit(scene : Scene) : Unit = {}
  }

  case class Textify() extends LabelRender {
    private var textCache : Map[String, Text] = Map.empty
    override def graphicalRepresentation(node: GameobjectNode, elements: SensorEntries, world : Graph, scene: Scene): Output = {
      val result = elements
        .map { case (_, value) => normalizeValue(value) }
        .mkString("\n")
      val style = textCache.headOption.map { case (_, p) => new TextStyle(p.getTextMetrics())}.getOrElse(new TextStyle())
      val gameobject = textCache.get(node.id)
        .map(_.setText(normalizeValue(result)))
        .map(_.setPosition(node.x, node.y))
        .getOrElse(scene.add.text(node.x, node.y, normalizeValue(result), style))
      textCache += node.id -> gameobject
      gameobject.ignoreDestroy = true
      Seq((gameobject, elements.map { case (name, value) => name}))
    }
  }

  case class TextifyBitmap(except : Set[String] = Set.empty) extends LabelRender {
    val fontSize = 12 //todo put in a global configuration object
    //val textureUrl = "https://labs.phaser.io/assets/fonts/bitmap/atari-smooth.png"
    //val fontUrl = "https://labs.phaser.io/assets/fonts/bitmap/atari-smooth.xml"
    val textureUrl = "./fonts/font.png"
    val fontUrl = "./fonts/font.xml"
    private val cache : mutable.Map[String, BitmapText] = new mutable.HashMap()
    override def graphicalRepresentation(node: GameobjectNode, elements: SensorEntries, world : Graph, scene: Scene): Output = {
      val textLabel = elements
        .filterNot { case (name, _) => except.contains(name) }
      val result = textLabel
        .map { case (name, value) => normalizeValue(value) }
        .mkString("\n")
      val text = cache.getOrElseUpdate(node.id, scene.add.bitmapText(node.x + node.width / 2, node.y, "fonts", normalizeValue(result), fontSize))
      text.ignoreDestroy = true
      text.setPosition(node.x + node.width / 2, node.y)
      text.setText(normalizeValue(result))
      Seq((text, textLabel.map { case (name, value) => name}))
    }
    override def onInit(scene : Scene) : Unit = scene.load.bitmapFont("fonts", textureUrl, fontUrl)
  }

  case class BooleanRender() extends LabelRender {
    val falseAlpha = 0.2
    val colorMultiplier = 1000
    val initialColor : Int = Color.White
    val trueAlpha = 1
    val lineWidth = 1

    override def graphicalRepresentation(node: GameobjectNode, elements: SensorEntries, world : Graph, scene: Scene): Output = {
      val circleSize = (node.width / 2).toInt
      val deltaY = circleSize * 2
      val deltaX = node.width
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

  case class BooleanExport() extends LabelRender {
    val falseExport = 0.3
    val trueExport = 1.0
    val strokeSize = 2

    override def graphicalRepresentation(node: GameobjectNode, elements: SensorEntries, world : Graph,  scene: Scene): Output = {
      val exp = elements.collect { case ("export", e: BasicWebIncarnation#EXPORT) => e }
        .map { _.root[Any]() }
        .collectFirst { case e: Boolean => e }
      exp match {
        case None => Seq.empty
        case Some(value) => val exportValue = if (value) trueExport else falseExport
          val computedStrokeSize = if (value) strokeSize else 0
          val unsafeNode: Shape = node.asInstanceOf[Shape]
          unsafeNode.setFillStyle(unsafeNode.fillColor, alpha = exportValue)
          unsafeNode.setStrokeStyle(computedStrokeSize, Color.Cyan, 1)
          Seq((node: GameObject) -> Seq("export"))
      }
    }
  }

  case class GradientLike() extends LabelRender {
    override def graphicalRepresentation(node: GameobjectNode, elements: SensorEntries, world : Graph,  scene: Scene): Output = {
      val label = "export"
      val circleSize = (node.width / 2)
      val result = elements.collect { case (`label`, e: BasicWebIncarnation#EXPORT) => e.root[Any]() }
        .collect { case e: Double => e }
      type FoldType = (Int, Seq[(GameObject, Seq[String])])
      result.flatMap {
        gradient =>
          val nodeColor = ColorNamespace.HSLToColor(gradient / 1920, 0.5, 0.5)
          val gameObject = scene.add.circle(node.x, node.y, circleSize, nodeColor.color)
          Seq(gameObject -> Seq(label))
      }
    }
  }

  case class MatrixLedRender() extends LabelRender {
    val elemSize = 3
    //todo try here with cache

    private val cache = new mutable.HashMap[String, Seq[(Int, Int, Rectangle)]]()
    override def graphicalRepresentation(node: GameobjectNode, elements: SensorEntries, world : Graph,  scene: Scene): Output = {
      def delta(index : Int) : Double =  index * elemSize + elemSize / 2
      val result = elements.collectFirst { case (label, e: MatrixLed) => (label, e) }

      result match {
        case Some((label, matrix)) =>
          val matrixSize = (matrix.dimension * elemSize) / 2
          val center = (node.x - matrixSize, node.y - matrixSize)
          val matrixObjs = cache.getOrElseUpdate(node.id, {
            for {
              i <- 0 until matrix.dimension
              j <- 0 until matrix.dimension
            } yield ({
              val result = (i, j, scene.add.rectangle(0, 0, elemSize, elemSize, Color.White))
              result._3.ignoreDestroy = true
              result
            })
          })
          matrixObjs.foreach { case (i, j, rect) => {
            rect.fillColor = matrix.get(i, j).get
            rect.setPosition(center._1 + delta(i), center._2 + delta(j))
          }}
          val elems = matrixObjs.map(_._3)
          elems.map(_ -> Seq(label))
        case None => Seq.empty
      }
    }
  }

  def normalizeValue(any : Any) : String = {
    val realValue = any match {
      case e : BasicWebIncarnation#EXPORT => removeActuationFrom(e.root[Any]())
      case other => other
    }
    realValue match {
      case value : Double => "%.2f".format(value)
      case value : Int => value.toString
      case other => other.toString
    }
  }

  private def removeActuationFrom(e : Any) : String = {
    val dataFlatten = e match {
      case e : ActuationData => Seq()
      case e : Product => e.productIterator.toList.filter(_.isInstanceOf[ActuationData])
      case e : Iterable[_] => e
      case e : Any => Seq(e)
    }
    dataFlatten.filterNot(_.isInstanceOf[ActuationData]).mkString("(", ",", ")")
  }
}
