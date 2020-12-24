package it.unibo.scafi.js.dsl

import it.unibo.scafi.incarnations.Incarnation
import it.unibo.scafi.js.dsl.typeclass.BoundedJs

import scala.scalajs.js
import scala.scalajs.js.annotation.JSExportAll
@JSExportAll
class ScafiInterpreterJs[+I <: Incarnation](implicit val incarnation: I) {
  import incarnation._
  private val adapter = new BasicInterpreter()
  class BasicInterpreter extends AggregateProgram {
    override def main(): Any = throw new IllegalStateException("This method should not be called as the aggregate program only works as API provider.")
  }
  private class RoundVMWrapper() extends RoundVM {
    import adapter._
    override def exportStack: List[incarnation.Export with incarnation.ExportOps] = vm.exportStack
    override def `export`: incarnation.Export with incarnation.ExportOps = vm.`export`
    override def registerRoot(v: Any): Unit = vm.registerRoot(v)
    override def self: incarnation.ID = vm.self
    override def neighbour: Option[incarnation.ID] = vm.neighbour
    override def index: Int = vm.index
    override def previousRoundVal[A]: Option[A] = vm.previousRoundVal
    override def neighbourVal[A]: A = vm.neighbourVal
    override def foldedEval[A](expr: => A)(id: incarnation.ID): Option[A] = vm.foldedEval(expr)(id)
    override def localSense[A](name: incarnation.LSNS): A = vm.localSense(name)
    override def neighbourSense[A](name: incarnation.NSNS): A = vm.neighbourSense(name)
    override def nest[A](slot: incarnation.Slot)(write: Boolean, inc: Boolean)(expr: => A): A = vm.nest(slot)(write, inc)(expr)
    override def locally[A](a: => A): A = vm.locally(a)
    override def alignedNeighbours(): List[incarnation.ID] = vm.alignedNeighbours()
    override def elicitAggregateFunctionTag(): Any = vm.elicitAggregateFunctionTag()
    override def isolate[A](expr: => A): A = vm.isolate(expr)
    override def newExportStack: Any = vm.newExportStack
    override def discardExport: Any = vm.discardExport
    override def mergeExport: Any = vm.mergeExport
    override def saveFunction[T](f: => T): Unit = vm.saveFunction(f)
    override def loadFunction[T](): () => T = vm.loadFunction()
  }
  class SharedInterpreter extends BasicInterpreter {
    this.vm = new RoundVMWrapper()
  }
  def adaptForScafi(fun : js.Function0[Any]) : js.Function1[CONTEXT,EXPORT] = context => {
    adapter.round(context, fun())
  }
  protected implicit def boundedConversion[A](bound : BoundedJs[A]) : incarnation.Builtins.Bounded[A] = {
    new incarnation.Builtins.Bounded[A] {
      override def top: A = bound.top
      override def bottom: A = bound.bottom
      override def compare(a: A, b: A): Int = bound.compare(a, b)
    }
  }
}