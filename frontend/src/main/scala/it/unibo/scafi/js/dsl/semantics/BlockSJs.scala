package it.unibo.scafi.js.dsl.semantics

import it.unibo.scafi.incarnations.BasicAbstractIncarnation
import it.unibo.scafi.js.dsl.{Metric, ScafiInterpreterJs}
import it.unibo.scafi.lib.StandardLibrary
import scala.scalajs.js.annotation.JSExportAll
@JSExportAll
trait BlockSJs {
  self: ScafiInterpreterJs[BasicAbstractIncarnation with StandardLibrary] =>
  private val eval = new SharedInterpreter with incarnation.BlockS with incarnation.StandardSensors
  def S(grain: Double, metric: Metric): Unit = eval.S(grain, metric)
  def S2(grain: Double): Unit = eval.S2(grain)
}
