package it.unibo.scafi.js.lib

import it.unibo.scafi.incarnations.Incarnation
import it.unibo.scafi.lib.StandardLibrary
import it.unibo.scafi.space.Point3D.toPoint2D
import it.unibo.scafi.space.{Point2D, Point3D}

import java.util.Optional

trait MovementLibrary extends BasicMovement_Lib with Flock_Lib {
  self: Incarnation with ActuationLib with StandardLibrary =>

  override type P = Point2D
  trait ProgramMovementImplicits {
    self: Actuation =>
    type Velocity = Cartesian
    object Velocity {
      val Zero: Cartesian = new Velocity(0, 0)
      def apply(x: Double, y: Double): Velocity = Cartesian(x, y)
    }
    implicit def tupleToVelocity(p: (Double, Double)): Point3D = new Point3D(p._1, p._2, 0)
    implicit def OptionalToOption[E](p: Optional[E]): Option[E] = if (p.isPresent) Some(p.get()) else None
    implicit class RichPoint3D(p: Point3D) {
      val module: Double = math.hypot(p.x, p.y)
      lazy val normalized: Point2D = {
        val result = toPoint2D(p / module)
        if (result.x.isNaN || result.y.isNaN) {
          toPoint2D(Point3D.Zero)
        } else {
          result
        }
      }
      def unary_- : Point3D = Point3D(-p.x, -p.y, -p.z)
      def -(other: Point3D): Point3D = p + (-other)
      def *(alpha: Double): Point3D = Point3D(p.x * alpha, p.y * alpha, p.z * alpha)
      def /(alpha: Double): Point3D = p * (1.0 / alpha)
      def ===(other: Point3D): Boolean =
        other.x == p.x && other.y == p.x && other.z == p.z // todo solve the bug in scafi lib
      val isZero: Boolean = p.x == 0.0 && p.y == 0.0
    }
    implicit class RichMovement(v: Velocity) {
      def +(o: Velocity): Velocity = Velocity(o.dx + v.dx, o.dy + v.dy)
      def -(o: Velocity): Velocity = Velocity(v.dx + o.dx, v.dy - o.dy)
      def unary_- : Velocity = new Velocity(-v.dx, -v.dy)
      def *(alpha: Double): Velocity = Velocity(v.dx * alpha, v.dy * alpha)
      def /(alpha: Double): Velocity = v * (1.0 / alpha)
      val module: Double = math.hypot(v.dx, v.dy)
      lazy val normalized: Velocity = {
        val result = v / module
        if (result.dx.isNaN || result.dy.isNaN) {
          Velocity.Zero
        } else {
          result
        }
      }
    }
  }
}

object MovementLibrary {
  type Subcomponent = Incarnation with MovementLibrary with ActuationLib with StandardLibrary
}
