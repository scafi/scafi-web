package it.unibo.scafi.js.dsl

import it.unibo.scafi.incarnations.Incarnation
import it.unibo.scafi.js.model.MatrixOps
import it.unibo.scafi.js.model.MatrixOps._
import org.scalajs.dom.ext.Color

trait ActuationLib {
  self :  Incarnation =>

  trait Actuation {
    self : AggregateProgram =>
    sealed trait LedMode
    case object off extends LedMode
    case object on extends LedMode

    case class LedSelect(cell : LedGroup) {
      def to(color: Color): MatrixOps = MatrixOps(color, cell)
      def to(color: String): MatrixOps = MatrixOps(getColorFrom(color), cell)
      def off(ledMode: LedMode) : MatrixOps = ledMode match {
        case off => MatrixOps(Color.Black, cell)
        case _ => MatrixOps(Color.White, cell)
      }
    }

    def ledX : LedSelect = LedSelect(Combine(Seq(Diagonal, AntiDiagonal)))
    def ledO : LedSelect = LedSelect(Ring)
    def ledAll : LedSelect = LedSelect(All)
    def ledD : LedSelect = LedSelect(Diagonal)
    def ledAD : LedSelect = LedSelect(AntiDiagonal)
    def ledCol(i : Int) : LedSelect = LedSelect(Column(i))
    def ledRow(i : Int) : LedSelect = LedSelect(Row(i))
    def led(i : Int, j : Int) : LedSelect = LedSelect(One(i, j))

    private def getColorFrom(s : String) : Color = s match {
      case "white" => Color.White
      case "red" => Color.Red
      case "green" => Color.Green
      case "blue" => Color.Blue
      case "yellow" => Color.Yellow
      case "cyan" => Color.Cyan
      case "magenta" => Color.Magenta
      case hex => Color.apply(hex)
    }
  }
}
