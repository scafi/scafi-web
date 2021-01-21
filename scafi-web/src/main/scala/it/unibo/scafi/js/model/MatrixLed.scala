package it.unibo.scafi.js.model

import org.scalajs.dom.ext.Color

//TODO doc
trait MatrixLed {
  def dimension : Int
  def set(i : Int, j : Int, color : Color) : Option[MatrixLed]
  def setBulk(elems : Seq[(Int, Int, Color)]) : Option[MatrixLed]
  def all(color: Color) : MatrixLed
  def get(i : Int, j : Int) : Option[Color]
  def leds : Seq[(Int, Seq[(Int, Color)])]
}

object MatrixLed {
  def fill(dimension : Int, color : Color) : MatrixLed = {
    val internalMap = (0 until dimension).flatMap(i => (0 until dimension).map(i -> _))
      .map { case (i,j) => (i, j) -> color }
      .toMap
    new MatrixImpl(dimension, internalMap)
  }

  private class MatrixImpl(val dimension : Int, map : Map[(Int, Int), Color]) extends MatrixLed {
    override def set(i: Int, j: Int, color : Color): Option[MatrixLed] = inBound[MatrixLed](i, j) {
      (i, j) => new MatrixImpl(dimension, map + ((i, j) -> color))
    }

    override def get(i: Int, j: Int): Option[Color] = inBound(i, j) {
      (i, j) => map(i, j)
    }

    override def leds: Seq[(Int, Seq[(Int, Color)])] = map.groupBy { case ((row, _), _) => row }
      .mapValues(values => values.map { case ((row, col), color) => col -> color} )
      .mapValues(_.toSeq)
      .toSeq

    private def inBound[A](i : Int, j : Int)(op : (Int, Int) => A) : Option[A] = if (i < dimension && j < dimension) {
      Some(op(i, j))
    } else {
      None
    }

    override def setBulk(elems: Seq[(Int, Int, Color)]): Option[MatrixLed] = {
      val invalidCoords = elems.map { case (row, col, _) => inBound[Unit](row, col) { (a, b) => {} } }.exists(_.isEmpty)
      if(invalidCoords) {
        None
      } else {
        val newRep = elems.map { case (row, col, color) => (row, col) -> color }.toMap
        Some(new MatrixImpl(dimension, map ++ newRep))
      }
    }

    override def all(color: Color): MatrixLed = new MatrixImpl(dimension, map.mapValues(_ => color))
  }
}
