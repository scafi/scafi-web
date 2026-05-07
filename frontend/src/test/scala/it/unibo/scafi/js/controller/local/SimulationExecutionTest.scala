package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.model.{Graph, NaiveGraph}
import monix.eval.Task
import monix.reactive.Observable

import scala.concurrent.{Future, Promise}

class SimulationExecutionTest extends SupportTesterLike {
  import SimulationExecutionTest._

  describe("Execution platform") {
    it("should produce graph side effects on invalidate") {
      val result = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      localPlatform.publish(localPlatform.NewConfiguration)
      result.map { graph => graph.nodes.size shouldBe (cols * rows) }
    }

    it("should produce graph on invalidated") {
      val result = localPlatform.graphStream.firstL.runToFuture(monixScheduler)
      localPlatform.publish(localPlatform.Invalidated)
      result.map { graph => graph.nodes.size shouldBe (cols * rows) }
    }
  }
}

object SimulationExecutionTest {
  def countDifferences(g1 : Graph, g2: Graph) : Int = (g1, g2) match {
    case (g1 : NaiveGraph, g2 : NaiveGraph) =>
      g1.nodes
      .map(leftNode => (leftNode, g2(leftNode.id)))
      .count { case (leftNode, rightNode) => leftNode.labels != rightNode.labels }
    case _ => 0
  }

  def completeAfterN[E](elements : Int, source : Observable[E]) : Task[Int] = source.foldWhileLeft(0){
    case (`elements`, _) => Right(elements)
    case (count, _) => Left(count + 1)
  }.lastL

  def wakeUpAfter(time : Long) : Future[Unit] = {
    val promise = Promise[Unit]()
    scala.scalajs.js.timers.setTimeout(time)(promise.success({}))
    promise.future
  }
}
