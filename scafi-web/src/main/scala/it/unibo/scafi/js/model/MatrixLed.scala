package it.unibo.scafi.js.model

import it.unibo.scafi.js.model.MatrixLed.Led

import scala.scalajs.js

//TODO doc


trait MatrixLed extends js.Object {
  val matrixMatch : Unit //used only for pattern matching, fragile
  def dimension : Int
  def set(led : Led) : js.UndefOr[MatrixLed]
  def setBulk(elems : js.Array[Led]) : js.UndefOr[MatrixLed]
  def all(color: String) : MatrixLed
  def get(i : Int, j : Int) : js.UndefOr[String]
}

object MatrixLed {
  def unapply(a : js.Object) : Option[MatrixLed] = {
    if (a.hasOwnProperty("matrixMatch")) {
      Some(a.asInstanceOf[MatrixLed])
    } else {
      None
    }
  }
  def label : String = "matrix"

  class Led(val i : Int, val j : Int, val color : String) extends js.Object
  def fill(dimension : Int, color : String) : MatrixLed = {
    val internalMap = (0 until dimension).flatMap(i => (0 until dimension).map(i -> _))
      .map { case (i,j) => (i, j) -> color }
      .toMap
    new MatrixImpl(dimension, internalMap)
  }

  private class MatrixImpl(val dimension : Int, map : Map[(Int, Int), String]) extends MatrixLed {
    override def set(led : Led): js.UndefOr[MatrixLed] = inBound[MatrixLed](led.i, led.j) {
      (i, j) => new MatrixImpl(dimension, map + ((i, j) -> led.color))
    }

    override def get(i: Int, j: Int): js.UndefOr[String] = inBound(i, j) { (i, j) => map(i, j) }

    private def inBound[A](i : Int, j : Int)(op : (Int, Int) => A) : js.UndefOr[A] = if (i < dimension && j < dimension) {
      op(i, j)
    } else {
      js.undefined
    }

    override def setBulk(elems: js.Array[Led]): js.UndefOr[MatrixLed] = {
      val invalidCoords = elems.map { led => inBound[Int](led.i, led.j) { (a, b) => a } }.exists(_.isEmpty)

      if(invalidCoords) {
        js.undefined
      } else {
        val newRep = elems.map { led => (led.i, led.j) -> led.color }.toMap
        new MatrixImpl(dimension, map ++ newRep)
      }
    }

    override def all(color: String): MatrixLed = new MatrixImpl(dimension, map.mapValues(_ => color))

    override val matrixMatch: Unit = {}
  }
}
