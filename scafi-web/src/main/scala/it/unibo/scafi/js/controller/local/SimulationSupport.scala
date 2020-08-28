package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.WebIncarnation._
import it.unibo.scafi.js.controller.AggregateSystemSupport
import it.unibo.scafi.js.controller.local.SimulationSideEffect.{ExportProduced, Invalidated, NewConfiguration}
import it.unibo.scafi.js.model._
import monix.eval.Task
import monix.execution.Cancelable
import monix.reactive.Observable
import monix.reactive.subjects.PublishSubject

import scala.concurrent.Future

class SimulationSupport(private var systemConfig: SupportConfiguration)
  extends AggregateSystemSupport[SpaceAwareSimulator, SupportConfiguration, SimulationSideEffect] {

  protected var backend: SpaceAwareSimulator = fromConfig(systemConfig)

  protected val sideEffectsStream : PublishSubject[SimulationSideEffect] = PublishSubject()

  import monix.execution.Scheduler.Implicits.global

  override val graphStream: Observable[Graph] = sideEffectsStream.scan(Graph.empty)(mapSideEffect).share
  private val localSubscriber : Cancelable = graphStream.subscribe() // turn graph stream in an hot one
  sideEffectsStream.onNext(Invalidated)

  override def evolve(config: SupportConfiguration): Future[Unit] = Task.eval[Unit]{ fromConfig(systemConfig) } runToFuture

  private def fromConfig(config: SupportConfiguration) : SpaceAwareSimulator = {
    backend = (config.network, config.neighbour) match {
      case (grid : GridLikeNetwork, SpatialRadius(range)) =>
        simulatorFactory.gridLike(grid.toGridSettings, range, seeds = config.seed.toSeeds).asInstanceOf[SpaceAwareSimulator]
      case (random : RandomNetwork, SpatialRadius(range)) =>
        simulatorFactory.random(random.min, random.max, range, random.howMany, config.seed.toSeeds)
      case _ => throw new IllegalArgumentException("configuration not supported")
    }
    config.deviceShape.sensors.foreach { case (sensorName, value) => backend.addSensor(sensorName, value) }

    for ((id, sensorValues) <- config.deviceShape.initialValues) {
      for ((sensorName, sensorValue) <- sensorValues) {
        backend.chgSensorValue(sensorName, Set(id), sensorValue)
      }
    }
    backend
  }
  //todo move in web incarnation
  private def randomSpace(randomNet : RandomNetwork, range : Double, settings : SupportConfiguration) : SpaceAwareSimulator = {
    null
  }
  private def mapSideEffect(graph : Graph, sideEffect : SimulationSideEffect) : Graph = {
    (sideEffect, graph) match {
      case (NewConfiguration, _) => produceGraphFromNetwork()
      case (Invalidated, _) => produceGraphFromNetwork()
      case (ExportProduced(elements), graph) => updateGraphWithExports(elements, graph)
      case _ => produceGraphFromNetwork()
    }
  }

  private def produceGraphFromNetwork() : Graph = {
    val nodes : Set[Node] = backend.exports()
      .map { case (id, export) => (backend.devs(id), export )}
      .map {
        case (dev, Some(export)) => (dev, dev.lsns + ("export" -> export))
        case (dev, None) => (dev, dev.lsns)
      }
      .map { case (dev, labels) => Node(dev.id, dev.pos, labels)}
      .toSet
    val vertices = backend.getAllNeighbours()
      .flatMap { case (id, elements) => elements.map(Vertex(id, _)) }
      .toSet
    NaiveGraph(nodes, vertices)
  }

  private def updateGraphWithExports(exports: Seq[(ID, EXPORT)], graph: Graph) : Graph = {
    val newNodes = exports.map { case (id, export) => export -> graph(id) }
      .map { case (export, node) => node.copy(labels = node.labels + ("export" -> export))}
    NaiveGraph((graph.nodes -- newNodes) ++ newNodes, graph.vertices)
  }
}
