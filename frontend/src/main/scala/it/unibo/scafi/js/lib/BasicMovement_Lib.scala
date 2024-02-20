package it.unibo.scafi.js.lib

import it.unibo.scafi.space.Point2D

trait BasicMovement_Lib {
  self: MovementLibrary.Subcomponent =>

  trait Movement2D extends ProgramMovementImplicits {
    self: FieldCalculusSyntax with StandardSensors with Actuation with BlockT with BlocksWithGC with CustomSpawn =>

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
    def myNbrVector: Cartesian = {
      val result = nbr(currentPosition()) - currentPosition()
      Cartesian(result.x, result.y)
    }

    def alignWithLeader(source: Boolean, velocity: Cartesian): Cartesian =
      G(source, velocity, identity[Cartesian], nbrRange)

    def maintainTrajectory(velocityGenerator: => Cartesian)(time: Int): Cartesian =
      rep(velocityGenerator)(previousVelocity => mux(impulsesEvery(time))(velocityGenerator)(previousVelocity))

    def brownian(scale: Double = 1.0): Cartesian =
      randomInNegativeUnitSphere(scale)

    def line(
        leader: Boolean,
        distance: Double,
        confidence: Double,
        leaderVelocity: => Cartesian = Velocity.Zero
    ): Cartesian = {
      val potential = fastGradient(leader)
      val nodes = getNodeInfo(potential)
      val (left, right) = orderedNodes(nodes).splitAt(nodes.size / 2)
      val leftSuggestion = left.zipWithIndex.map { case ((id, velocity), i) =>
        id -> (Cartesian(-(i + 1) * distance, 0) + velocity)
      }.toMap
      val rightSuggestions = right.zipWithIndex.map { case ((id, velocity), i) =>
        id -> (Cartesian((i + 1) * distance, 0) + velocity)
      }.toMap
      mux(leader)(leaderVelocity) {
        val direction =
          broadcastAlongWithShare(potential, leftSuggestion ++ rightSuggestions, nbrRange)
            .getOrElse(mid().asInstanceOf[ID], Velocity.Zero)
        mux(direction.module < confidence)(Velocity.Zero)(direction.normalized)
      }
    }
    def centeredCircle(
        leader: Boolean,
        radius: Double,
        confidence: Double,
        leaderVelocity: => Cartesian = Velocity.Zero
    ): Cartesian = {
      val potential = fastGradient(leader)
      val nodes = getNodeInfo(potential)
      val division = (math.Pi * 2) / nodes.size
      val suggestion = orderedNodes(nodes).zipWithIndex.map { case ((id, v), i) =>
        val angle = division * (i + 1)
        id -> (Cartesian(math.sin(angle) * radius, math.cos(angle) * radius) + v)
      }.toMap
      mux(leader)(leaderVelocity) {
        val direction =
          broadcastAlongWithShare(potential, suggestion).getOrElse(mid().asInstanceOf[ID], Velocity.Zero)
        mux(direction.module < confidence)(Velocity.Zero)(direction.normalized)
      }
    }

    private def getNodeInfo(potential: Double): Set[(ID, Cartesian)] = {
      val distanceFromLeader = GAlongWithShare[Cartesian](potential, Cartesian(0, 0), v => v + myNbrVector, nbrRange)
      CWithShare[Double, Set[(ID, Cartesian)]](
        potential,
        (a, b) => a ++ b,
        Set((mid(), distanceFromLeader)),
        Set.empty[(ID, Velocity)]
      )
    }

    def fastGradient(source: Boolean, metric: Metric = nbrRange): Double = {
      share(Double.PositiveInfinity) { case (_, nbrg) =>
        mux(source)(0.0)(minHoodPlus(nbrg() + metric()))
      }
    }

    def GAlongWithShare[V](gradient: Double, field: V, accumulator: V => V, metric: Metric = nbrRange): V = {
      share(field) { case (_, nbrField) =>
        mux(gradient == 0.0)(field) {
          excludingSelf.minHoodSelector[Double, V](nbr(gradient) + metric())(accumulator(nbrField())).getOrElse(field)
        }
      }
    }

    def CWithShare[P: Builtins.Bounded, V](potential: P, accumulator: (V, V) => V, local: V, Null: V): V =
      share(local) { (_, nbrv) =>
        accumulator(
          local,
          foldhood(Null)(accumulator) {
            mux(nbr(findParent(potential)) == mid())(nbrv())(nbr(Null))
          }
        )
      }

    def GWithShare[V](source: Boolean, field: V, acc: V => V, metric: Metric = nbrRange): V =
      share((Double.MaxValue, field)) { case (_, nbrvalues) =>
        mux(source) {
          (0.0, field)
        } {
          excludingSelf
            .minHoodSelector(nbrvalues()._1 + metric())((nbrvalues()._1 + metric() + metric(), acc(nbrvalues()._2)))
            .getOrElse((Double.PositiveInfinity, field))
        }
      }._2

    def broadcastAlongWithShare[V](g: Double, value: V, metric: Metric = nbrRange) =
      GAlongWithShare(g, value, identity[V], metric)

    private def orderedNodes(nodes: Set[(ID, Cartesian)]): List[(ID, Cartesian)] = nodes
      .filter(_._1 != mid())
      .toList
      .sortBy(_._1)(Ordering.Int)
    private def randomInNegativeUnitSphere(scale: Double): Cartesian = {
      val x = randomGenerator().nextDouble() * 2 - 1
      val y = randomGenerator().nextDouble() * 2 - 1
      Cartesian(x * scale, y * scale)
    }
    def sinkAt(source: Boolean): Velocity =
      GWithShare[Velocity](source, Velocity.Zero, vector => vector + myNbrVector, nbrRange).normalized

    def spinAround(center: Boolean): Cartesian = {
      val spinning = sinkAt(center)
      Cartesian(spinning.dy, -spinning.dx)
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
