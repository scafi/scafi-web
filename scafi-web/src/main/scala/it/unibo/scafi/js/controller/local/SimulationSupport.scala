package it.unibo.scafi.js.controller.local

import it.unibo.scafi.config.{GridSettings, ShapeSettings}
import it.unibo.scafi.js.WebIncarnation._
import it.unibo.scafi.js.controller.AggregateSystemSupport
import it.unibo.scafi.js.controller.local.SimulationSideEffect.{Invalidated, NewConfiguration}
import it.unibo.scafi.js.model._
import monix.reactive.Observable
import monix.reactive.subjects.PublishSubject

import scala.concurrent.Future

class SimulationSupport(systemConfig: ShapeSettings) extends AggregateSystemSupport[SpaceAwareSimulator, ShapeSettings, SimulationSideEffect] {
  protected var backend: SpaceAwareSimulator = fromConfig(systemConfig)

  protected val sideEffectsStream : PublishSubject[SimulationSideEffect] = PublishSubject()

  import monix.execution.Scheduler.Implicits.global

  override def evolve(config: ShapeSettings): Future[Unit] = Future{}

  override val graphStream: Observable[Graph] = sideEffectsStream.scan[Graph](NaiveGraph(Set(), Set()))((graph, sideEffect) => mapSideEffect(sideEffect, graph)).share

  private def fromConfig(systemConfig: ShapeSettings) : SpaceAwareSimulator = {
    backend = simulatorFactory.gridLike(
      GridSettings(stepx = 50, stepy = 50, tolerance = 0),
      rng = 60.0
    ).asInstanceOf[SpaceAwareSimulator]
    backend.addSensor("source", false)
    backend.chgSensorValue("source", Set("1", "55", "86"), true)
    backend
  }

  private def mapSideEffect(sideEffect : SimulationSideEffect, graph : Graph) : Graph = (sideEffect, graph) match {
    case (NewConfiguration, _) => produceGraphFromNetwork()
    case (Invalidated, _) => produceGraphFromNetwork()
    case _ => produceGraphFromNetwork()
  }

  private def produceGraphFromNetwork() : Graph = {
    val nodes : Set[Node] = backend.exports()
      .map { case (id, export) => (backend.devs(id), export )}
      .map {
        case (dev, Some(export)) => (dev, Label("export", export) :: devInfoToLabel(dev))
        case (dev, None) => (dev, devInfoToLabel(dev))
      }
      .map { case (dev, labels) => Node(dev.id, dev.pos, labels:_*)}
      .toSet
    val vertices = backend.getAllNeighbours()
      .flatMap { case (id, elements) => elements.map(Vertex(id, _)) }
      .toSet
    NaiveGraph(nodes, vertices)
  }

  private def devInfoToLabel(dev : DevInfo) : List[Label] = dev.lsns.map { case (name, value) => Label(name, value)} toList
}
