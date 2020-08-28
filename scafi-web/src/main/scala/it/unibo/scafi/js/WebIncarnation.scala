package it.unibo.scafi.js

import it.unibo.scafi.config.{GridSettings, SimpleRandomSettings}
import it.unibo.scafi.incarnations.Incarnation
import it.unibo.scafi.simulation.{Simulation, SpatialSimulation}
import it.unibo.scafi.space.optimization.nn.QuadTree
import it.unibo.scafi.space.{BasicSpatialAbstraction, Point2D}
import it.unibo.utils.{Interop, Linearizable}

import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer
import scala.util.Random

trait BasicWebIncarnation extends Incarnation with Simulation {
  override type LSNS = String
  override type NSNS = String
  override type ID = String
  override type EXECUTION = AggregateInterpreter
  override val LSNS_POSITION: String = "position"
  override val LSNS_TIME: String = "currentTime"
  override val LSNS_TIMESTAMP: String = "timestamp"
  override val LSNS_DELTA_TIME: String = "deltaTime"
  override val LSNS_RANDOM: String = "randomGenerator"
  override val NBR_RANGE: String = "nbrRange"
  override val NBR_DELAY: String = "nbrDelay"
  override val NBR_LAG: String = "nbrLag"
  override val NBR_VECTOR: String = "nbrVector"

  @transient implicit override val linearID: Linearizable[ID] = new Linearizable[ID] {
    override def toNum(v: ID): Int = Integer.parseInt(v)
    override def fromNum(n: Int): ID = n.toString
  }
  @transient implicit override val interopID: Interop[ID] = new Interop[ID] {
    def toString(id: ID): String = id
    def fromString(str: String): ID = str
  }
  @transient implicit override val interopLSNS: Interop[LSNS] = new Interop[LSNS] {
    def toString(lsns: LSNS): String = lsns.toString
    def fromString(str: String): LSNS = str
  }
  @transient implicit override val interopNSNS: Interop[NSNS] = new Interop[NSNS] {
    def toString(nsns: NSNS): String = nsns.toString
    def fromString(str: String): NSNS = str
  }
}

object WebIncarnation extends BasicWebIncarnation
  with SpatialSimulation
  with BasicSpatialAbstraction {
  override type P = Point2D

  override def buildNewSpace[E](elems: Iterable[(E,P)]): SPACE[E] =
    buildSpatialContainer(elems, EuclideanStrategy.DefaultProximityThreshold)

  def buildSpatialContainer[E](elems: Iterable[(E,P)] = Iterable.empty,
                               range: Double = EuclideanStrategy.DefaultProximityThreshold): SPACE[E] =
    new Basic3DSpace(elems.toMap) with EuclideanStrategy {
      override val proximityThreshold = range
    }

  trait WebSimulatorFactory extends SimulatorFactory {
    def random(min : Double, max : Double, range : Double, howMany : Int, seeds: Seeds) : SpaceAwareSimulator
  }
  override def simulatorFactory: WebSimulatorFactory = {
    val superReference = super.simulatorFactory
    new WebSimulatorFactory {
      override def random(min : Double, max : Double, range: JSNumber, howMany : Int, seeds: Seeds): SpaceAwareSimulator = {
        val random = new Random(seeds.configSeed)
        def rangeRandom() : Double = min + random.nextDouble() * (max - min)
        def randomPosition() : P = new P(rangeRandom(), rangeRandom())
        val nodePosition = (0 until howMany).map(id => id.toString -> randomPosition()).toMap
        val deviceMap = nodePosition.map { case (id, pos) => id -> new DevInfo(id, pos, nsns = nsns => (id : ID) => _)}
        new QuadTreeSpace[]()
        val space : SPACE[ID] = new Basic3DSpace(nodePosition, range) //TODO fix quad tree space for being scala.js supported
        new SpaceAwareSimulator(space, deviceMap, simulationSeed = seeds.simulationSeed, randomSensorSeed = seeds.randomSensorSeed)
      }

      override def basicSimulator(idArray: ArrayBuffer[String],
                                  nbrMap: mutable.Map[String, Set[String]],
                                  lsnsMap: mutable.Map[String, mutable.Map[String, Any]],
                                  nsnsMap: mutable.Map[String, mutable.Map[String, mutable.Map[String, Any]]]): NETWORK = {
        superReference.basicSimulator(idArray, nbrMap, lsnsMap, nsnsMap)
      }

      override def simulator(idArray: ArrayBuffer[String],
                             nbrMap: mutable.Map[String, Set[String]],
                             localSensors: PartialFunction[String, PartialFunction[String, Any]],
                             nbrSensors: PartialFunction[String, PartialFunction[(String, String), Any]]) : NETWORK = {
        superReference.simulator(idArray, nbrMap, localSensors, nbrSensors)
      }

      override def gridLike(gsettings: GridSettings,
                            rng: JSNumber,
                            lsnsMap: mutable.Map[String, mutable.Map[String, Any]],
                            nsnsMap: mutable.Map[String, mutable.Map[String, mutable.Map[String, Any]]],
                            seeds: WebIncarnation.Seeds): NETWORK = {
        superReference.gridLike(gsettings, rng, lsnsMap, nsnsMap, seeds)
      }
    }
  }

}