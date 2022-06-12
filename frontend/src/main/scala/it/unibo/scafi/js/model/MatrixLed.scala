package it.unibo.scafi.js.model

import it.unibo.scafi.js.model.MatrixLed.Led
import scala.scalajs.js
import upickle.default._

sealed trait MatrixLed {
  def dimension: Int
  def set(led: Led): js.UndefOr[MatrixLed]
  def setBulk(elems: Seq[Led]): js.UndefOr[MatrixLed]
  def all(color: String): MatrixLed
  def get(i: Int, j: Int): js.UndefOr[String]
}

object MatrixLed {
  case class Led(i: Int, j: Int, color: String)
  def fill(dimension: Int, color: String): MatrixLed = {
    val internalMap =
      (0 until dimension).flatMap(i => (0 until dimension).map(i -> _)).map { case (i, j) => (i, j) -> color }.toMap
    MatrixMap(dimension, internalMap)
  }
  implicit def ledRW: ReadWriter[Led] = macroRW[Led]
  implicit def matrixLedRW: ReadWriter[MatrixLed] = macroRW[MatrixLed]
  implicit def matrixMap: ReadWriter[MatrixMap] = macroRW[MatrixMap]

  case class MatrixMap(dimension: Int, pixels: Map[(Int, Int), String]) extends MatrixLed {
    override def set(led: Led): js.UndefOr[MatrixLed] = inBound[MatrixLed](led.i, led.j) { (i, j) =>
      MatrixMap(dimension, pixels + ((i, j) -> led.color))
    }

    override def get(i: Int, j: Int): js.UndefOr[String] = inBound(i, j)((i, j) => pixels(i, j))

    private def inBound[A](i: Int, j: Int)(op: (Int, Int) => A): js.UndefOr[A] = if (i < dimension && j < dimension) {
      op(i, j)
    } else {
      js.undefined
    }

    override def setBulk(elems: Seq[Led]): js.UndefOr[MatrixLed] = {
      val invalidCoords = elems.map(led => inBound[Int](led.i, led.j)((a, b) => a)).exists(_.isEmpty)

      if (invalidCoords) {
        js.undefined
      } else {
        val newRep = elems.map(led => (led.i, led.j) -> led.color).toMap
        MatrixMap(dimension, pixels ++ newRep)
      }
    }

    override def all(color: String): MatrixLed = MatrixMap(dimension, pixels.mapValues(_ => color))
  }
}
