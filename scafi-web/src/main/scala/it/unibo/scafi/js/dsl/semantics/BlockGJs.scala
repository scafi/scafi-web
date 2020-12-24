package it.unibo.scafi.js.dsl.semantics

import it.unibo.scafi.incarnations.{BasicAbstractIncarnation, Incarnation}
import it.unibo.scafi.js.dsl
import it.unibo.scafi.js.dsl.{JF1, ScafiInterpreterJs}
import it.unibo.scafi.lib.StandardLibrary

import scala.scalajs.js.annotation.JSExportAll
@JSExportAll
trait BlockGJs {
  self : ScafiInterpreterJs[_ <: Incarnation with StandardLibrary] =>
  import incarnation._
  private val eval = new SharedInterpreter with BlockG with StandardSensors
  def G_along[V](g: Double, metric: dsl.Metric, field: V, acc: JF1[V, V]): V = {
    eval.G_along(g, () => metric(), field, v => acc(v))
  }
  def G[V](source: Boolean, field: V, acc: JF1[V, V], metric: dsl.Metric): V = {
    eval.G(source, field, v => acc(v), () => metric())
  }
  def distanceTo(source: Boolean, metric: dsl.Metric): Double = {
    eval.distanceTo(source, () => metric())
  }
  def broadcast[V](source: Boolean, field: V, metric: dsl.Metric): V = {
    eval.broadcast(source, field, () => metric())
  }
  def distanceBetween(source: Boolean, target: Boolean, metric: dsl.Metric): Double = {
    eval.distanceBetween(source, target, () => metric())
  }
  def channel(source: Boolean, target: Boolean, width: Double): Boolean = {
    eval.channel(source, target, width)
  }
}
