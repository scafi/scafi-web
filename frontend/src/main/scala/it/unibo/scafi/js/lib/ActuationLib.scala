package it.unibo.scafi.js.lib

import it.unibo.scafi.incarnations.Incarnation
import it.unibo.scafi.js.facade.phaser.namespaces.display.ColorNamespace
import it.unibo.scafi.js.model.MatrixOps._
import it.unibo.scafi.js.model.Movement.{AbsoluteMovement, VectorMovement}
import it.unibo.scafi.js.model.{MatrixOps, Movement}
import org.scalajs.dom.ext.Color

import scala.scalajs.js.|

trait ActuationLib {
  self: Incarnation =>

  trait Actuation {
    self: AggregateProgram =>
    sealed trait LedMode
    case object off extends LedMode
    case object on extends LedMode
    def rgb(r: Int, g: Int, b: Int): Color = Color.apply(r, g, b)
    def hsl(h: Double, s: Double, l: Double): Color = {
      val phaserColor = ColorNamespace.HSLToColor(h, s, l)
      Color.apply(phaserColor.r, phaserColor.g, phaserColor.b)
    }
    def hue(h: Double): Color = hsl(h, 0.5, 0.5)
    case class LedSelect(cell: LedGroup) {
      def to(color: Color | String | LedMode): MatrixOps = (color: Any) match {
        case s: String => MatrixOps(getColorFrom(s), cell)
        case c: Color  => MatrixOps(c, cell)
        case off       => MatrixOps(Color.Black, cell)
        case on        => MatrixOps(Color.White, cell)
      }
    }

    def ledX: LedSelect = LedSelect(Combine(Seq(Diagonal, AntiDiagonal)))
    def ledO: LedSelect = LedSelect(Ring)
    def ledAll: LedSelect = LedSelect(All)
    def ledD: LedSelect = LedSelect(Diagonal)
    def ledAD: LedSelect = LedSelect(AntiDiagonal)
    def ledCol(i: Int): LedSelect = LedSelect(Column(i))
    def ledRow(i: Int): LedSelect = LedSelect(Row(i))
    def led(i: Int, j: Int): LedSelect = LedSelect(One(i, j))

    private def getColorFrom(s: String): Color = s match {
      case "white"   => Color.White
      case "red"     => Color.Red
      case "green"   => Color.Green
      case "blue"    => Color.Blue
      case "yellow"  => Color.Yellow
      case "cyan"    => Color.Cyan
      case "magenta" => Color.Magenta
      case hex       => Color.apply(hex)
    }

    sealed trait VelocityComponent
    case class Polar(module: Double, angle: Double) extends VelocityComponent
    case class Cartesian(dx: Double, dy: Double) extends VelocityComponent

    case object VelocitySelect {
      def set(polar: Polar): Movement =
        VectorMovement(polar.module * Math.sin(polar.angle), polar.module * Math.cos(polar.angle))
      def set(cartesian: Cartesian): Movement = VectorMovement(cartesian.dx, cartesian.dy)
    }

    case object PositionSelect {
      def set(position: (Double, Double)): Movement = AbsoluteMovement(position._1, position._2)
    }

    def velocity: VelocitySelect.type = VelocitySelect
    def position: PositionSelect.type = PositionSelect
  }
}
