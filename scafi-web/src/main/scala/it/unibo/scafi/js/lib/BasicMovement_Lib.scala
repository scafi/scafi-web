package it.unibo.scafi.js.lib

import it.unibo.scafi.space.Point2D

trait BasicMovement_Lib {
  self: MovementLibrary.Subcomponent =>

  trait Movement2D extends ProgramMovementImplicits {
    self: FieldCalculusSyntax with StandardSensors with Actuation =>

    sealed trait Zone
    case class CircularZone(center: (Double, Double), radius: Double) extends Zone
    case class RectangularZone(center: (Double, Double), width: Double, height: Double) extends Zone

    def clockwiseRotation(center: (Double, Double)): Velocity = {
      val centerVector = currentPosition() - center
      Velocity(centerVector.y, -centerVector.x).normalized
    }

    def anticlockwiseRotation(center: (Double, Double)): Velocity = -clockwiseRotation(center)

    def goToPoint(dx: Double, dy: Double): Velocity = {
      val point = Point2D(dx, dy)
      val distanceVector = (point - currentPosition()).normalized
      Velocity(distanceVector.x, distanceVector.y)
    }

    def standStill: Velocity = Velocity.Zero

    def explore(zone: Zone, trajectoryTime: Int, reachGoalRange: Double = 0): Velocity = {
      require(trajectoryTime > 0)
      val (_, _, velocity) = rep((randomCoordZone(zone), trajectoryTime, Velocity.Zero)) {
        case (goal, decay, v) if decay == 0 => (randomCoordZone(zone), trajectoryTime, v)
        case (goal, decay, v) if goal.distance(currentPosition()) < reachGoalRange =>
          (goal, 0, goToPoint(goal.x, goal.y))
        case (goal, decay, v) => (goal, decay - 1, goToPoint(goal.x, goal.y))
      }
      velocity
    }

    private def randomCoordZone(zone: Zone): Point2D = zone match {
      case CircularZone((cx, cy), radius) =>
        Point2D(cx + radius * positiveNegativeRandom(), cy + radius * positiveNegativeRandom())
      case RectangularZone((rx, ry), w, h) =>
        Point2D(rx + (w / 2) * positiveNegativeRandom(), ry + (h / 2) * positiveNegativeRandom())
    }

    private def positiveNegativeRandom(): Double = {
      val multi = if (nextRandom() < 0.5) 1 else -1
      multi * nextRandom()
    }
  }
}
