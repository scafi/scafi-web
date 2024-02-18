package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.AggregateSystemSupport
import it.unibo.scafi.js.controller.local.SimulationSideEffect._
import it.unibo.scafi.js.dsl.{BasicWebIncarnation, ScafiInterpreterJs}
import it.unibo.scafi.js.model._
import it.unibo.scafi.simulation.SpatialSimulation
import it.unibo.scafi.space.Point3D
import monix.execution.Cancelable
import monix.reactive.Observable
import monix.reactive.subjects.PublishSubject
import org.scalajs.dom.ext.Color

import scala.concurrent.Future
//TODO make support more general
/** Support for manage a local aggregate simulation simulation
  * @param systemConfig
  *   initialize the backend with this configuration object
  */
class SimulationSupport(protected var systemConfig: SupportConfiguration)(
    implicit val incarnation: BasicWebIncarnation,
    implicit val interpreter: ScafiInterpreterJs[BasicWebIncarnation]
) extends AggregateSystemSupport[SpatialSimulation#SpaceAwareSimulator, SupportConfiguration, SimulationSideEffect]
    with SideEffects {
  import SimulationSupport._
  import incarnation._
  protected var backend: SpaceAwareSimulator = fromConfig(systemConfig)

  protected val sideEffectsStream: PublishSubject[SimulationSideEffect] = PublishSubject()

  import monix.execution.Scheduler.Implicits.global

  override val graphStream: Observable[Graph] = sideEffectsStream.scan(Graph.empty)(mapSideEffect).share
  private val localSubscriber: Cancelable = graphStream.subscribe() // turn graph stream in an hot one
  sideEffectsStream.onNext(Invalidated)

  override def evolve(config: SupportConfiguration): Future[Unit] = Future.successful {
    fromConfig(config)
    invalidate()
  }

  def invalidate(): Unit = sideEffectsStream.onNext(Invalidated)

  private def fromConfig(config: SupportConfiguration): SpaceAwareSimulator = {
    backend = (config.network, config.neighbour) match {
      case (grid: GridLikeNetwork, SpatialRadius(range)) =>
        simulatorFactory
          .gridLike(grid.toGridSettings, range, seeds = backendSeed(config))
          .asInstanceOf[SpaceAwareSimulator]
      case (random: RandomNetwork, SpatialRadius(range)) =>
        // TODO FIX
        simulatorFactory
          .random(random.min, random.max, range, random.howMany, backendSeed(config))
          .asInstanceOf[SpaceAwareSimulator] // todo improve this
      case _ => throw new IllegalArgumentException("configuration not supported")
    }
    config.deviceShape.sensors.foreach { case (sensorName, value) => backend.addSensor(sensorName, value) }

    for ((id, sensorValues) <- config.deviceShape.initialValues)
      for ((sensorName, sensorValue) <- sensorValues)
        backend.chgSensorValue(sensorName, Set(id.toInt), sensorValue)
    systemConfig = config
    backend
  }

  private def mapSideEffect(graph: Graph, sideEffect: SimulationSideEffect): Graph = {
    (sideEffect, graph) match {
      case (NewConfiguration, _) => produceGraphFromNetwork()
      case (Invalidated, _) => produceGraphFromNetwork()
      case (ExportProduced(elements), graph) => updateGraphWithExports(elements, graph)
      case (PositionChanged(positionMap), graph) => updateGraphWithPosition(positionMap, graph)
      case (SensorChanged(sensorMap), graph) => updateGraphWithSensor(sensorMap, graph)
      case _ => produceGraphFromNetwork()
    }
  }

  private def produceGraphFromNetwork(): Graph = {
    val nodes: Set[Node] = backend
      .exports()
      .map { case (id, export) => (backend.devs(id), export) }
      .map {
        case (dev, Some(export)) => (dev, dev.lsns + (EXPORT_LABEL -> export))
        case (dev, None) => (dev, dev.lsns)
      }
      .map { case (dev, labels) => Node(dev.id.toString, dev.pos, labels) }
      .toSet
    val vertices = computeVertices()
    NaiveGraph(nodes, vertices)
  }

  import GraphOps.Implicits._
  private def updateGraphWithExports(exports: Seq[(ID, EXPORT)], graph: Graph): Graph = {
    val newExports = exports.map { case (id, export) => export -> graph(id.toString) }.map { case (export, node) =>
      node.copy(labels = node.labels + (EXPORT_LABEL -> export))
    }
    graph.insertNodes(newExports)
  }

  private def updateGraphWithPosition(positionMap: Map[ID, Point3D], graph: Graph): Graph = {
    val nodesUpdated = positionMap
      .map { case (id, pos) => pos -> graph(id.toString) }
      .map { case (pos, node) => node.copy(position = pos) }
      .toSeq
    NaiveGraph(
      graph.insertNodes(nodesUpdated).nodes,
      computeVertices()
    ) // neighbour could be change, todo improve performance
  }

  private def updateGraphWithSensor(sensorMap: Map[ID, Map[CNAME, Any]], graph: Graph) = {
    val nodeUpdated =
      sensorMap.toSeq.map { case (id, labels) => labels -> graph(id.toString) }.map { case (labels, node) =>
        node.copy(labels = node.labels ++ labels)
      }
    graph.insertNodes(nodeUpdated)
  }

  private def computeVertices(): Set[Vertex] =
    backend
      .getAllNeighbours()
      .flatMap { case (id, elements) => elements.map(e => Vertex(id.toString, e.toString)) }
      .toSet

  private def backendSeed(config: SupportConfiguration): Seeds = {
    val SimulationSeeds(configSeed, simulationSeed, randomSensorSeed) = config.seed
    Seeds(configSeed.toLong, simulationSeed.toLong, randomSensorSeed.toLong)
  }
}

object SimulationSupport {
  val EXPORT_LABEL = "export"
}
