package it.unibo.scafi.js.dsl
import it.unibo.scafi.js.WebIncarnation._
import it.unibo.scafi.js.dsl.ScafiDslJs.LanguageConverter

import scala.scalajs.js
import scala.scalajs.js.annotation.JSExportTopLevel

/**
 * a standard way to define a js program in the browser. this code is executed in a simulator.
 */
@JSExportTopLevel("scafiDsl")
object StandardWebDsl extends ScafiDslJs with LanguageConverter[CONTEXT, EXPORT]{
  private val program = new AggregateProgram {
    override def main(): Any = {
      throw new IllegalStateException("This method should not be called as the aggregate program only works as API provider.")
    }
  }
  override def mux[A](cond: Boolean, ifTrue: A, ifFalse: A): A = program.mux(cond)(ifTrue)(ifFalse)
  override def branch[A](cond: js.Function0[Boolean], ifTrue: js.Function0[A], ifFalse: js.Function0[A]): A = {
    program.branch{cond()}{ifTrue()}{ifFalse()}
  }
  override def rep[A](init: js.Function0[A], fun: js.Function1[A, A]): A = program.rep(init())(fun)
  override def foldhood[A](init: js.Function0[A], aggr: js.Function2[A, A, A], expr: js.Function0[A]): A = {
    program.foldhood{init()}{aggr}{expr()}
  }
  override def foldhoodPlus[A](init: js.Function0[A], aggr: js.Function2[A, A, A], expr: js.Function0[A]): A = {
    program.foldhoodPlus{init()}{aggr}{expr()}
  }
  override def aggregate[A](f: js.Function0[A]): A = program.aggregate{f()}
  override def align[K, V](key: K, comp: js.Function1[K, V]): V = program.align(key)(comp)
  override def mid(): String = program.mid()
  override def sense[A](name: String): A = program.sense(name)
  override def nbrvar[A](name: String): A = program.nbrvar(name)

  override def toScala(fun: js.Function0[Any]): js.Function1[CONTEXT, EXPORT] = (context : CONTEXT) => {
    program.round(context, fun())
  }
}
