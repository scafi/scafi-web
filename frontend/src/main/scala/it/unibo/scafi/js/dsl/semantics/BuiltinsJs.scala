package it.unibo.scafi.js.dsl.semantics

import it.unibo.scafi.incarnations.Incarnation
import it.unibo.scafi.js.dsl.typeclass.BoundedJs
import it.unibo.scafi.js.dsl.{JF0, JF2, ScafiInterpreterJs}
import it.unibo.scafi.lib.StandardLibrary
import scala.scalajs.js.annotation.JSExportAll

@JSExportAll
trait BuiltinsJs {
  self: ScafiInterpreterJs[_ <: Incarnation with StandardLibrary] =>
  private val eval = new SharedInterpreter()
  def branch[A](cond: JF0[Boolean], th: JF0[A], el: JF0[A]): A = eval.branch(cond())(th())(el())
  def mux[A](cond: Boolean, th: A, el: A): A = eval.mux(cond)(th)(el)
  def minHood[A](expr: JF0[A], bound: BoundedJs[A]): A = eval.minHood(expr())(bound)
  def maxHood[A](expr: JF0[A], bound: BoundedJs[A]): A = eval.maxHood(expr())(bound)
  def foldhoodPlus[A](init: JF0[A], aggr: JF2[A, A, A], expr: JF0[A]): A =
    eval.foldhoodPlus(init())((a, b) => aggr(a, b))(expr())
  def minHoodPlus[A](expr: JF0[A], bound: BoundedJs[A]): A = eval.minHoodPlus(expr())(bound)
  def maxHoodPlus[A](expr: JF0[A], bound: BoundedJs[A]): A = eval.maxHoodPlus(expr())(bound)
}
