package it.unibo.scafi.js.dsl.semantics

import it.unibo.scafi.incarnations.Incarnation
import it.unibo.scafi.js.dsl.ScafiInterpreterJs
import scala.scalajs.js
import scala.scalajs.js.annotation.JSExportAll
@JSExportAll
trait LanguageJs {
  self : ScafiInterpreterJs[_ <: Incarnation] =>
  private val eval = new SharedInterpreter
  def nbr[A](expr: js.Function0[A]): A = eval.nbr(expr())
  def rep[A](init: js.Function0[A], fun: js.Function1[A, A]): A = eval.rep(init())(a => fun(a))
  def foldhood[A](init: js.Function0[A], aggr: js.Function2[A, A, A], expr: js.Function0[A]): A = {
    eval.foldhood(init())((a,b) => aggr(a,b))(expr())
  }
  def aggregate[A](f: js.Function0[A]): A = eval.aggregate(f())
  def align[K, V](key: K, comp: js.Function1[K, V]): V = eval.align(key)((v : K) => comp(v))
  def mid(): String = eval.mid().toString //todo eval if it is correct
  def sense[A](name: String): A = eval.sense(name.asInstanceOf[incarnation.CNAME])
  def nbrvar[A](name: String): A = eval.nbrvar(name.asInstanceOf[incarnation.CNAME]) //TODO this isn't the correct way to handle this.. find another way
}
