package it.unibo.scafi.js.dsl

import it.unibo.scafi.config.GridSettings
import it.unibo.scafi.incarnations.Incarnation
import it.unibo.scafi.js.lib.{ActuationLib, MovementLibrary}
import it.unibo.scafi.js.utils.JSNumber
import it.unibo.scafi.lib.StandardLibrary
import it.unibo.scafi.simulation.SpatialSimulation
import it.unibo.scafi.space.Point2D
import it.unibo.utils.{Interop, Linearizable}

import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer
import scala.concurrent.duration.FiniteDuration
import scala.util.Random

trait BasicWebIncarnation
    extends Incarnation
    with SpatialSimulation
    with StandardLibrary
    with ActuationLib
    with MovementLibrary {
  import Builtins.Bounded
  implicit override val idBounded: Bounded[ID] = Builtins.Bounded.of_i
  override type CNAME = String
  override type ID = Int
  override type P = Point2D
  override type EXECUTION = AggregateInterpreter
  implicit override val interopID: Interop[Int] = new Interop[Int] {
    override def toString(data: Int): String = data.toString
    override def fromString(s: String): Int = s.toInt
  }
  override def cnameFromString(s: String): String = s

  @transient implicit override val linearID: Linearizable[ID] = new Linearizable[ID] {
    override def toNum(v: ID): Int = v
    override def fromNum(n: Int): ID = n
  }
  @transient implicit override val interopCNAME: Interop[CNAME] = new Interop[CNAME] {
    override def toString(data: CNAME): String = data
    override def fromString(s: String): CNAME = s
  }

  trait WebSimulatorFactory extends SimulatorFactory {
    def random(min: Double, max: Double, range: Double, howMany: Int, seeds: Seeds): NETWORK
  }

  override def simulatorFactory: WebSimulatorFactory = {
    val superReference = super.simulatorFactory
    new WebSimulatorFactory {
      override def random(
          min: Double,
          max: Double,
          range: JSNumber,
          howMany: Int,
          seeds: Seeds
      ): SpaceAwareSimulator = {
        val random = new Random(seeds.configSeed)
        def rangeRandom(): Double = min + random.nextDouble() * (max - min)
        def randomPosition(): P = new P(rangeRandom(), rangeRandom())
        val nodePosition = (0 until howMany).map(id => id -> randomPosition()).toMap
        val deviceMap = nodePosition.map { case (id, pos) => id -> new DevInfo(id, pos, nsns = nsns => (id: ID) => _) }
        val space: SPACE[ID] =
          new Basic3DSpace(nodePosition, range) // TODO fix quad tree space for being scala.js supported
        new SpaceAwareSimulator(
          space,
          deviceMap,
          simulationSeed = seeds.simulationSeed,
          randomSensorSeed = seeds.randomSensorSeed
        )
      }

      override def basicSimulator(
          idArray: ArrayBuffer[ID],
          nbrMap: mutable.Map[ID, Set[ID]],
          lsnsMap: mutable.Map[CNAME, mutable.Map[ID, Any]],
          nsnsMap: mutable.Map[CNAME, mutable.Map[ID, mutable.Map[ID, Any]]]
      ): NETWORK =
        superReference.basicSimulator(idArray, nbrMap, lsnsMap, nsnsMap)

      override def simulator(
          idArray: ArrayBuffer[ID],
          nbrMap: mutable.Map[ID, Set[ID]],
          localSensors: PartialFunction[CNAME, PartialFunction[ID, Any]],
          nbrSensors: PartialFunction[CNAME, PartialFunction[(ID, ID), Any]]
      ): NETWORK =
        superReference.simulator(idArray, nbrMap, localSensors, nbrSensors)

      override def gridLike(
          gsettings: GridSettings,
          rng: JSNumber,
          lsnsMap: mutable.Map[CNAME, mutable.Map[ID, Any]],
          nsnsMap: mutable.Map[CNAME, mutable.Map[ID, mutable.Map[ID, Any]]],
          seeds: Seeds
      ): NETWORK =
        superReference.gridLike(gsettings, rng, lsnsMap, nsnsMap, seeds)

    }
  }
}

object WebIncarnation extends BasicWebIncarnation with StandardLibrary {
  override type P = Point2D

  override def buildNewSpace[E](elems: Iterable[(E, P)]): SPACE[E] =
    buildSpatialContainer(elems, EuclideanStrategy.DefaultProximityThreshold)

  def buildSpatialContainer[E](
      elems: Iterable[(E, P)] = Iterable.empty,
      range: Double = EuclideanStrategy.DefaultProximityThreshold
  ): SPACE[E] =
    new Basic3DSpace(elems.toMap) with EuclideanStrategy {
      override val proximityThreshold = range
    }

  override type Time = FiniteDuration
}
