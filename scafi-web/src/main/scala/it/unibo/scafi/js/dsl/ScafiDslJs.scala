package it.unibo.scafi.js.dsl

import scala.scalajs.js
import scala.scalajs.js.annotation.JSExportAll

/**
 * a subset of scafi lang used for writing scafi code via javascript.
 * this interface define only the main constructor, the implementation depends on the incarnation used.
 */
@JSExportAll
trait ScafiDslJs {
  def mux[A](cond: Boolean, ifTrue: A, ifFalse: A): A
  def branch[A](cond : js.Function0[Boolean], ifTrue: js.Function0[A], ifFalse: js.Function0[A]) : A
  def rep[A](init: js.Function0[A], fun: js.Function1[A,A]): A
  def foldhood[A](init: js.Function0[A], aggr: js.Function2[A,A,A], expr: js.Function0[A]): A
  def foldhoodPlus[A](init: js.Function0[A], aggr: js.Function2[A,A,A], expr: js.Function0[A]): A
  def aggregate[A](f: js.Function0[A]): A
  def align[K, V](key: K, comp: js.Function1[K, V]): V
  def mid(): String
  def sense[A](name: String): A
  def nbrvar[A](name: String): A
}

object ScafiDslJs {

  @JSExportAll
  trait LanguageConverter[CONTEXT, EXPORT] {
    def toScala(fun : js.Function0[Any]) : js.Function1[CONTEXT,EXPORT]
  }
}
