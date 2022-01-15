package it.unibo.scafi.js.dsl.semantics

import it.unibo.scafi.incarnations.{BasicAbstractIncarnation, Incarnation}
import it.unibo.scafi.js.dsl.typeclass.BoundedJs
import it.unibo.scafi.js.dsl.{JF2, ScafiInterpreterJs}
import it.unibo.scafi.lib.StandardLibrary

import scala.scalajs.js.annotation.JSExportAll
@JSExportAll
trait BlockCJs {
  self: ScafiInterpreterJs[_ <: Incarnation with StandardLibrary] =>
  private val eval = new SharedInterpreter with incarnation.BlockC with incarnation.StandardSensors
  def C[P, V](potential: P, acc: JF2[V, V, V], local: V, Null: V, bound: BoundedJs[P]): V =
    eval.C[P, V](potential, (a, b) => acc(a, b), local, Null)(bound)
}
