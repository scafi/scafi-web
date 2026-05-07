package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.AggregateSystemSupport
import it.unibo.scafi.js.controller.local.SimulationSideEffect._
import it.unibo.scafi.js.model._
import monix.execution.Cancelable
import monix.reactive.Observable
import monix.reactive.subjects.PublishSubject

import scala.collection.mutable
import scala.concurrent.Future
import scala.util.Random

class SimulationSupport(protected var systemConfig: SupportConfiguration)
    extends AggregateSystemSupport[SimulationSupport.SimulationBackend, SupportConfiguration, SimulationSideEffect]
    with SideEffects {
  import SimulationSupport._

  protected var backend: SimulationBackend = SimulationBackend.fromConfig(systemConfig)

  protected val sideEffectsStream: PublishSubject[SimulationSideEffect] = PublishSubject()

  import monix.execution.Scheduler.Implicits.global

  override val graphStream: Observable[Graph] = sideEffectsStream.scan(Graph.empty)(mapSideEffect).share
  private val localSubscriber: Cancelable = graphStream.subscribe()
  sideEffectsStream.onNext(Invalidated)

  override def evolve(config: SupportConfiguration): Future[Unit] = Future.successful {
    backend = SimulationBackend.fromConfig(config)
    invalidate()
  }

  def invalidate(): Unit = sideEffectsStream.onNext(Invalidated)

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
    val nodes: Set[Node] = backend.devs.map { case (id, dev) =>
      val labels = backend.exports.get(id).flatten match {
        case Some(exp) => dev.lsns + (EXPORT_LABEL -> exp)
        case None => dev.lsns
      }
      Node(id, dev.pos, labels)
    }.toSet
    val vertices = backend.neighbours.flatMap { case (id, nbrs) => nbrs.map(Vertex(id, _)) }.toSet
    NaiveGraph(nodes, vertices)
  }

  import GraphOps.Implicits._
  private def updateGraphWithExports(exports: Seq[(String, Any)], graph: Graph): Graph = {
    val newExports = exports.map { case (id, export) => export -> graph(id) }.map { case (export, node) =>
      node.copy(labels = node.labels + (EXPORT_LABEL -> export))
    }
    graph.insertNodes(newExports)
  }

  private def updateGraphWithPosition(positionMap: Map[String, Vec3], graph: Graph): Graph = {
    val nodesUpdated = positionMap
      .map { case (id, pos) => graph(id).copy(position = pos) }
      .toSeq
    NaiveGraph(graph.insertNodes(nodesUpdated).nodes, computeVertices())
  }

  private def updateGraphWithSensor(sensorMap: Map[String, Map[String, Any]], graph: Graph) = {
    val nodeUpdated = sensorMap.toSeq.map { case (id, labels) => labels -> graph(id) }.map { case (labels, node) =>
      node.copy(labels = node.labels ++ labels)
    }
    graph.insertNodes(nodeUpdated)
  }

  private def computeVertices(): Set[Vertex] =
    backend.neighbours.flatMap { case (id, nbrs) => nbrs.map(Vertex(id, _)) }.toSet
}

object SimulationSupport {
  val EXPORT_LABEL = "export"

  class SimulationBackend(
      val devs: mutable.Map[String, DevInfo],
      val neighbours: mutable.Map[String, Set[String]],
      val exports: mutable.Map[String, Option[Any]]
  ) {
    def setPosition(id: String, pos: Vec3): Unit =
      devs.get(id).foreach(d => devs(id) = d.copy(pos = pos))

    def chgSensorValue(sensorName: String, ids: Set[String], value: Any): Unit =
      ids.foreach { id => devs.get(id).foreach(d => devs(id) = d.copy(lsns = d.lsns + (sensorName -> value))) }

    def localSensor[T](sensorName: String)(id: String): Option[T] =
      devs.get(id).flatMap(_.lsns.get(sensorName).map(_.asInstanceOf[T]))

    def context(id: String): Option[Any] = None
  }

  object SimulationBackend {
    val empty: SimulationBackend = new SimulationBackend(mutable.Map.empty, mutable.Map.empty, mutable.Map.empty)

    def fromConfig(config: SupportConfiguration): SimulationBackend = {
      val devs = mutable.Map.empty[String, DevInfo]
      val neighbours = mutable.Map.empty[String, Set[String]]

      config.network match {
        case GridLikeNetwork(rows, cols, stepX, stepY, tolerance) =>
          val range = config.neighbour match { case SpatialRadius(r) => r }
          val rng = new Random(config.seed.configSeed.toLong)
          val positions = mutable.Map.empty[String, Vec3]
          for (r <- 0 until rows; c <- 0 until cols) {
            val id = (r * cols + c).toString
            val tx = if (tolerance > 0) (rng.nextDouble() - 0.5) * tolerance else 0.0
            val ty = if (tolerance > 0) (rng.nextDouble() - 0.5) * tolerance else 0.0
            positions(id) = Vec3.from2D(c * stepX + tx, r * stepY + ty)
          }
          positions.foreach { case (id, pos) =>
            val sensors: Map[String, Any] = config.deviceShape.sensors.map { case (name, v) =>
              name -> (v: Any)
            }
            devs(id) = DevInfo(id, pos, sensors)
            neighbours(id) = positions.collect {
              case (nid, npos) if nid != id && pos.distance(npos) <= range => nid
            }.toSet
          }
        case _ => ()
      }

      config.deviceShape.initialValues.foreach { case (id, sensorValues) =>
        devs.get(id).foreach { dev =>
          devs(id) = dev.copy(lsns = dev.lsns ++ sensorValues.asInstanceOf[Map[String, Any]])
        }
      }

      new SimulationBackend(devs, neighbours, mutable.Map.empty)
    }
  }

  case class DevInfo(id: String, pos: Vec3, lsns: Map[String, Any] = Map.empty)
}
