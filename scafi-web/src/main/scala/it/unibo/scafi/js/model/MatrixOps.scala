package it.unibo.scafi.js.model

import it.unibo.scafi.js.model.MatrixOps.LedGroup
import org.scalajs.dom.ext.Color

//TODO doc
case class MatrixOps(color : Color, cells : LedGroup) extends ActuationData

object MatrixOps {
  sealed trait LedGroup
  case class One(i : Int, j : Int) extends LedGroup
  case class Row(i : Int) extends LedGroup
  case class Column(i : Int) extends LedGroup
  case object Diagonal extends LedGroup
  case object Ring extends LedGroup
  case object All extends LedGroup
  case object AntiDiagonal extends LedGroup
  case class Combine(ledGroup: Seq[LedGroup]) extends LedGroup

  def apply(action : MatrixOps, matrix : MatrixLed) : MatrixLed = {
    action.cells match {
      case One(i, j) => matrix.set(i, j, action.color).getOrElse(matrix)
      case Row(i) => val led = (0 until matrix.dimension).map((i, _, action.color))
        matrix.setBulk(led).getOrElse(matrix)
      case Column(j) => val led = (0 until matrix.dimension).map((_, j, action.color))
        matrix.setBulk(led).getOrElse(matrix)
      case All => matrix.all(action.color)
      case Diagonal => val cells = 0 until matrix.dimension
        val diagonal = cells.zip(cells).map { case (i, j) => (i, j, action.color)}
        matrix.setBulk(diagonal).getOrElse(matrix)
      case AntiDiagonal => val cells = 0 until matrix.dimension
        val antidigonal = cells.zip(cells.reverse).map { case (i, j) => (i, j,action.color)}
        matrix.setBulk(antidigonal).getOrElse(matrix)
      case Ring => matrix // TODO
      case Combine(head :: other) => val newMatrix = this.apply(action.copy(cells = head), matrix)
        this.apply(action.copy(cells = Combine(other)), newMatrix)
      case Combine(List()) => matrix
    }
  }
}
