package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.model.MatrixLed.MatrixMap
import it.unibo.scafi.js.model.{Graph, NaiveGraph, Node, Vec3, Vertex}

import scala.scalajs.js

object StandaloneGraphSnapshot {
  final case class ParseResult(graph: Graph, warnings: Seq[String])

  private val coreNodeKeys = Set("id", "x", "y")

  def toGraph(state: js.Dynamic): Option[ParseResult] = {
    if (state == null || js.isUndefined(state)) {
      None
    } else {
      val rawNodes = selectArray(state, "nodes")
      val nodes = rawNodes.flatMap(parseNode)
      val knownIds = nodes.map(_.id).toSet
      val edges = selectArray(state, "edges").flatMap(parseEdge)
      val validEdges = edges.collect { case (from, to) if knownIds.contains(from) && knownIds.contains(to) => Vertex(from, to) }.toSet
      val droppedEdges = edges.collect {
        case (from, to) if !knownIds.contains(from) || !knownIds.contains(to) =>
          s"Dropping standalone edge $from -> $to because at least one node is missing"
      }
      val nodeWarnings = if (nodes.size == rawNodes.length) {
        Seq.empty
      } else {
        Seq(s"Dropped ${rawNodes.length - nodes.size} malformed standalone nodes")
      }
      Some(ParseResult(NaiveGraph(nodes.toSet, validEdges), nodeWarnings ++ droppedEdges))
    }
  }

  private def parseNode(value: js.Any): Option[Node] = {
    val node = value.asInstanceOf[js.Dynamic]
    for {
      id <- select(node, "id").map(_.toString)
      x <- selectDouble(node, "x")
      y <- selectDouble(node, "y")
    } yield {
      val labels = select(node, "labels")
        .map(parseLabelEntries)
        .getOrElse(parseFlatNodeLabels(node))
      Node(id, Vec3.from2D(x, y), labels)
    }
  }

  private def parseEdge(value: js.Any): Option[(String, String)] = value match {
    case edge: js.Array[js.Any @unchecked] if edge.length >= 2 =>
      Some(edge(0).toString -> edge(1).toString)
    case _ =>
      val edge = value.asInstanceOf[js.Dynamic]
      for {
        from <- select(edge, "from").map(_.toString)
        to <- select(edge, "to").map(_.toString)
      } yield from -> to
  }

  private def parseFlatNodeLabels(node: js.Dynamic): Map[String, Any] = {
    js.Object
      .keys(node.asInstanceOf[js.Object])
      .map(_.toString)
      .filterNot(coreNodeKeys.contains)
      .flatMap { key =>
        select(node, key).map(value => key -> normalizeLabelValue(value))
      }
      .filterNot { case (_, value) => value == null }
      .toMap
  }

  private def parseLabelEntries(labels: js.Any): Map[String, Any] = {
    val obj = labels.asInstanceOf[js.Dynamic]
    js.Object
      .keys(obj.asInstanceOf[js.Object])
      .map(_.toString)
      .flatMap { key =>
        select(obj, key).map(value => key -> normalizeLabelValue(value))
      }
      .filterNot { case (_, value) => value == null }
      .toMap
  }

  private def normalizeLabelValue(value: js.Any): Any = {
    parseMatrix(value)
      .orElse(value.asInstanceOf[Any] match {
        case array: js.Array[js.Any @unchecked] => Some(array.toSeq.map(normalizeLabelValue))
        case iterable: Iterable[_] => Some(iterable.toSeq)
        case primitive => Some(primitive)
      })
      .orNull
  }

  private def parseMatrix(value: js.Any): Option[MatrixMap] = {
    if (value == null || js.isUndefined(value) || js.typeOf(value) != "object" || js.Array.isArray(value)) {
      None
    } else {
      val matrix = value.asInstanceOf[js.Dynamic]
      val maybeDimension = selectDouble(matrix, "dimension").map(_.toInt)
      val maybePixels = select(matrix, "pixels")
      (maybeDimension, maybePixels) match {
        case (Some(dimension), Some(rawPixels)) =>
          val pixels = parsePixels(rawPixels).toMap
          if (pixels.nonEmpty) Some(MatrixMap(dimension, pixels)) else None
        case _ => None
      }
    }
  }

  private def parsePixels(rawPixels: js.Any): Seq[((Int, Int), String)] = {
    selectArray(rawPixels.asInstanceOf[js.Dynamic], identity = true).flatMap {
      case pixel: js.Array[js.Any @unchecked] if pixel.length >= 2 =>
        pixel(0) match {
          case coordinates: js.Array[js.Any @unchecked] if coordinates.length >= 2 =>
            Some(((toInt(coordinates(0)), toInt(coordinates(1))), pixel(1).toString))
          case _ => None
        }
      case pixelValue =>
        val pixel = pixelValue.asInstanceOf[js.Dynamic]
        for {
          i <- selectDouble(pixel, "i").map(_.toInt)
          j <- selectDouble(pixel, "j").map(_.toInt)
          color <- select(pixel, "color").map(_.toString)
        } yield ((i, j), color)
    }
  }

  private def toInt(value: js.Any): Int = value.asInstanceOf[Any] match {
    case number: Double => number.toInt
    case number: Int => number
    case other => other.toString.toDouble.toInt
  }

  private def selectArray(value: js.Dynamic, key: String = "", identity: Boolean = false): Seq[js.Any] = {
    val raw = if (identity) value.asInstanceOf[js.Any] else select(value, key).orNull
    raw match {
      case array: js.Array[js.Any @unchecked] => array.toSeq
      case _ => Seq.empty
    }
  }

  private def select(value: js.Dynamic, key: String): Option[js.Any] = {
    val selected = value.selectDynamic(key)
    if (selected == null || js.isUndefined(selected)) None else Some(selected.asInstanceOf[js.Any])
  }

  private def selectDouble(value: js.Dynamic, key: String): Option[Double] =
    select(value, key).map {
      case jsValue =>
        jsValue.asInstanceOf[Any] match {
          case number: Double => number
          case number: Int => number.toDouble
          case other => other.toString.toDouble
        }
    }
}