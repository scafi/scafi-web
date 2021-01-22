package it.unibo.scafi.js.lib

import it.unibo.scafi.space.Point3D
/**
 * Flocking behaviour from Craig Reynolds (https://www.red3d.com/cwr/index.html)
 * implementation taken from https://gamedevelopment.tutsplus.com/tutorials/3-simple-rules-of-flocking-behaviors-alignment-cohesion-and-separation--gamedev-3444
 * other link : https://www.red3d.com/cwr/boids/
 * This library describes flocking like behaviour in the Aggregate Computing context.
 */
trait Flock_Lib {
  self : MovementLibrary.Subcomponent =>
  /**
   * This library defines:
   *  - a class to express a flock like behaviors;
   *  - some shortcuts for expressing flock behaviors;
   *  - an utility method (withSeparation) that move a node agglomerate trying to maintain a separation distance.
   */
  trait FlockLib {
    self: FieldCalculusSyntax with StandardSensors =>
    /**
      * This class summarize the parameters to describe a Flocking like behaviour.
      * @param flockingField the boolean field in which the flock behaviour should happen
      * @param attractionForce the weight of the attraction vector, default 1.0
      * @param alignmentForce the weight of the alignment vector, default 1.0
      * @param repulsionForce the weight of the repulsion vector, default 1.0
      * @param separationDistance the threshold used by repulsion force evaluation to consider two nodes as neighbours
      * @param otherVelocityEvaluation a sequence of other velocities evaluation that should influence boids (e.g. a goal position, the wind,...)
     */
    case class FlockBehaviour(flockingField: Boolean = true,
                              attractionForce: Double = 1.0,
                              alignmentForce: Double = 1.0,
                              repulsionForce: Double = 1.0,
                              separationDistance: Double = Double.PositiveInfinity,
                              otherVelocityEvaluation : List[() => Velocity] = List.empty) {
      /**
        * Using aggregate computing syntax, it returns a velocity field that simulate a flock behaviour according to the
        * weight and the other velocities passed. It is time dependent (internally, used rep constructor).
        * @return the velocity field (as unary vector) updating through time.
       */
      def run() : Velocity = {
        rep[Velocity](Velocity.Zero){ //it is a differential equation, I need to maintain the current "velocity" field.
          v => {
            val neighbourhoodField = getValuesFromActiveNode(flockingField)(currentPosition()) //get a field of neighbourhood position
            val mainVector = List(
              separation(neighbourhoodField, separationDistance) * repulsionForce,
              alignment(flockingField, v, neighbourhoodField.size) * alignmentForce,
              cohesion(neighbourhoodField) * attractionForce
            ) //eval the three main force, separation, alignment and cohesion, weighted by the corresponding scalar
            val other = otherVelocityEvaluation.map(_()) //eval other velocities vector, if any.
            val resultingVector = sumVectors(other ::: mainVector :_*) //velocities concatenation (by sum)
            (v + resultingVector).normalized
          }
        }
      }
    }
    /** A shortcut for FlockBehaviour.run() */
    def flock() : Velocity = FlockBehaviour().run()
    /** It has the opposite behaviour of flock. This is observed in nature when the swarm escape from an enemy (e.g. predator) */
    def antiflock() : Velocity = FlockBehaviour(attractionForce = -1, alignmentForce = - 1, repulsionForce = -1).run()
    /**
     * an utility method used to move a swarm of element with some velocity, maintaining a separation distance between elements.
     * It is similar to use FlockBehaviour(attractionForce = 0.0, alignmentForce = 0.0, separationDistance, otherVelocityEvaluation(velocity)).
     * However, in this case, the velocity is weighted according to the number of neighbours. In this way, the separation behaviour is always
     * preferred.
     * @param selector the boolean field in which the separation behaviour should happen
     * @param velocity the desired velocity field
     * @param separationDistance the target distance between each node.
     * @return a unit vector based on velocity evalutaiton and separation distance.
     */
    def withSeparation(selector : => Boolean)(velocity: => Velocity)(separationDistance: Double) : Velocity = {
      mux[Velocity](selector) {
        val activeNodeInRange = inRange(getValuesFromActiveNode(selector)(currentPosition()), separationDistance)
        ((velocity / (activeNodeInRange.size + 1)) + separation(activeNodeInRange, separationDistance)).normalized
      } {
        Velocity.Zero
      }
    }
    /** a shortcut for withSeparation(true)(velocity)(separationDistance) */
    def withSeparation(velocity: Velocity)(separationDistance: Double) : Velocity = withSeparation(selector = true)(velocity)(separationDistance)

    /* steer towards the average heading of local flockmates */
    private[Flock_Lib] def alignment(flockingSensor: => Boolean, velocity: Velocity, neighbourCount : Int): Velocity = {
      val averageVelocity: Velocity = getValuesFromActiveNode(flockingSensor)(velocity).fold(Velocity.Zero)(_ + _) / neighbourCount
      averageVelocity.normalized
    }
    /*steer to move toward the average position of local flockmates*/
    private[Flock_Lib] def cohesion(neighbors: Seq[Point3D]): Velocity = if(neighbors.isEmpty) {
      Velocity.Zero
    } else {
      val centroid = neighbors.fold(Point3D.Zero)((a,b) => a + b) / neighbors.size
      val vector = (centroid - currentPosition()).normalized
      Velocity(vector.x, vector.y)
    }
    /* steer to avoid crowding local flockmates */
    private[Flock_Lib] def separation(activeNode : Seq[Point3D], separationDistance: Double): Velocity = {
      val closestNeighbours = inRange(activeNode, separationDistance)
      val vectorsDirectToNeighbours = closestNeighbours.map(currentPosition() - _)
      val separationVector = vectorsDirectToNeighbours.fold[Point3D](Point3D.Zero)((acc, b) => acc + b)
      val vector = separationVector.normalized
      Velocity(vector.x, vector.y)
    }
    /* get the a value from its neighbour. The values are combined into a sequence of elements. */
    private[Flock_Lib] def getValuesFromActiveNode[E](flockingField : => Boolean)(value : => E) : Seq[E] = {
      foldhoodPlus[Seq[E]](Seq.empty[E])(_ ++ _){
        mux(nbr(flockingField)){
          Seq[E](nbr(value))
        } /* else */ {
          Seq.empty[E]
        }
      }
    }
    /* return node positions of elements with a distance lesser then range. */
    private def inRange(neighbours : Seq[Point3D], range : Double) : Seq[Point3D] = neighbours
      .filter(vector => currentPosition().distance(vector) < range)
    private def sumVectors(vectors : Velocity *) : Velocity = vectors.fold(Velocity.Zero)(_ + _)
  }
  object FlockLib {
    type Dependencies = AggregateProgram with StandardSensors
  }
  /**
   * This library defines a Type Enrichment (aka Pimp my library pattern) for FlockBehaviour.
   */
  trait AdvancedFlock {
    self : FlockLib with FlockLib.Dependencies with Movement2D => //a way to define component dependencies, using a companion object with a type alias.
    /**
     * The implicit class used to add some usual behaviour for FlockBehavior.
     */
    implicit class RichFlock(flock : FlockBehaviour) {
      /** A shortcut for flock.copy(otherVelocityEvaluation = ( () => v ) :: flock.otherVelocityEvaluation */
      def addBehaviour(v : => Velocity) : FlockBehaviour = flock.copy(otherVelocityEvaluation = (() => v) :: flock.otherVelocityEvaluation )
      /**
       * It simulates a constant force (a sort of wind) that guide the swarm to a direction
       * @param v the wind direction (express as velocity)
       * @return the behaviour with the wind influence
       */
      def withWind(v : Velocity) : FlockBehaviour = flock.addBehaviour(v.normalized)
      /**
       * It guide the swarm to a specific position (a global goal)
       * @param goal the target position where the swarm want to move on
       * @param importance how much the goal influences the swarm? (default 1.0)
       * @return the behaviour with the goal in mind
       */
      def withGoal(goal : P, importance : Double = 1.0) : FlockBehaviour = flock.addBehaviour { goToPoint(goal) * importance }
      /**
       * It guide the swarm to avoid a specific part of the field (delimited with obstacleSensor selector)
       * @param obstacleSensor the field that the swarm tends to avoid
       * @param force how much the obstacle avoidance influences the swarm? (default 1.0)
       * @return the behaviour with the obstacle avoidance influence
       */
      def withObstacleAvoid(obstacleSensor : => Boolean, force : Double = 1.0) : FlockBehaviour = {
        val unitVector = separation(getValuesFromActiveNode(obstacleSensor)(currentPosition()), Double.PositiveInfinity)
        flock.addBehaviour{ unitVector * force }
      }
    }
  }
}
