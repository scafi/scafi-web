package it.unibo.scafi.js.code

import it.unibo.scafi.js.controller.local.DeviceConfiguration

object MovementExamples {
  private val examples : Seq[Example] = Seq(
    Example.create("Change velocity") {
      """//using Actuation
        |mux(mid().toInt < 50) { velocity set Cartesian(1, 0) } { velocity set Polar(2, Math.PI) }""".stripMargin
    },
    Example.create("Absolute movement") {
      """//using Actuation
        |position set (50, 50)""".stripMargin
    },
    Example.create("Movement with rep") {
      """//using Actuation
        |val angle = rep(0.0)(v => v + 0.1)
        |velocity set Polar(1, angle)""".stripMargin
    },
    Example.create("Movement 2D lib: rotation", DeviceConfiguration.standard) {
      """//using Actuation, Movement2D, StandardSensors
        |val direction = mux(sense("source")) { clockwiseRotation(100.0, 100.0) } { anticlockwiseRotation(100.0, 100.0) }
        |velocity set direction""".stripMargin
    },
    Example.create("Movement 2D lib: go to") {
      """//using Actuation, Movement2D, StandardSensors
        |velocity set goToPoint(100, 100)""".stripMargin
    },
    Example.create("Movement 2D lib: explore") {
      """//using Actuation, Movement2D, StandardSensors
        |//val zone = CircularZone(center = (100.0, 100.0), radius = 500.0)
        |val zone = RectangularZone(center = (0.0, 0.0), width = 600, height = 600)
        |val trajectoryTime = 100
        |val reachGoalThr = 10.0
        |velocity set explore(zone, trajectoryTime, reachGoalThr)""".stripMargin
    },
    Example.create("Flock lib: basic") {
      """//using Actuation, FlockLib, StandardSensors
        |val flockVelocity = FlockBehaviour(
        |    attractionForce = 0.001,
        |    alignmentForce = 0.1,
        |    repulsionForce = 0.5,
        |    separationDistance = 10.0,
        |).run()
        |velocity set flockVelocity""".stripMargin
    },
    Example.create("Flock lib: with separation") {
      """/using Actuation, FlockLib, AdvancedFlock, Movement2D, StandardSensors
        |val weigth = 0.5
        |val separation = 30.0
        |velocity set withSeparation(goToPoint(0, 0) * weigth)(separation)
        |""".stripMargin
    },
    Example.create("Flock lib: advanced", DeviceConfiguration.standard) {
      """//using Actuation, FlockLib, AdvancedFlock, Movement2D, StandardSensors
        |
        |/*
        |  This example shows how to add behaviour to a standard flock behaviour. Check what happens if you enable sense2 in a part of the space.
        |  To enable sense2 you should select nodes and then click the number 2.
        | */
        |
        |val rotationWeight = 0.1
        |val goalWeight = 0.3
        |val obstacleWeight = 0.5
        |val target = (1000.0, 1000.0)
        |def obstacle : Boolean = sense("obstacle")
        |val flockVelocity = FlockBehaviour()
        |  .addBehaviour(anticlockwiseRotation(target) * rotationWeight) // via pimping AdvancedFlock, this tend to rotate toward the goal
        |  .withGoal(target, goalWeight) //this move the aggregate toward the target
        |  .withObstacleAvoid(obstacle, obstacleWeight) //this avoid a part of the computational field.
        |  .run()
        |velocity set flockVelocity""".stripMargin
    }
  )
  def apply() : ExampleGroup = ExampleGroup("Movement", examples)
}
