package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.controller.local.SimulationExecution.TickBased
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.model.{Graph, NaiveGraph}
import monix.eval.Task
import monix.reactive.Observable

import scala.concurrent.{Future, Promise}
import scala.util.{Failure, Success, Try}
class SimulationExecutionTest extends SupportTesterLike {
  import SimulationExecutionTest._
  //a non global context bring to a problems
  val longWait = 100
  describe("Execution platform") {
    it("should support javascript script") {
      val result = localPlatform.loadScript(Script.javascript {"10"})
      result.transform {
        case Success(any) => Try { succeed }
        case _ => Try { fail() }
      }
    }

    it("should check javascript error before creating execution") {
      val result = localPlatform.loadScript(Script.javascript("val u"))
      result.transform {
        case Success(value) => Try{ fail() }
        case Failure(exception) => Try{ succeed }
      }
    }
    it("should support tick by tick execution") {
      val execution = localPlatform.loadScript(Script.javascript("rep(() => 0, x => x + 1)"))
      val ticksTimes = 10
      val count = completeAfterN(ticksTimes, localPlatform.graphStream).runToFuture(monixScheduler)
      execution.foreach {
        case ticker : TickBased => execTickMultipleTimes(ticker, ticksTimes).runToFuture(monixScheduler)
        case _ =>
      }
      count map { case `ticksTimes` => succeed }
    }

    it("daemon produce side effects") {
      val execution = localPlatform.loadScript(Script.javascript("rep(() => 0, x => x + 1)"))
      val someComputations = 100
      val count = completeAfterN(someComputations, localPlatform.graphStream).runToFuture(monixScheduler)
      execution.map {
        case ticker : TickBased => ticker.toDaemon()
        case _ => throw new IllegalArgumentException
      }.flatMap { daemon => count.map {
          case `someComputations` => daemon.stop(); succeed
          case _ => fail()
        }
      }
    }
    it("daemon can be stopped") {
      val execution = localPlatform.loadScript(Script.javascript("rep(() => 0, x => x + 1)"))
      val someComputations = 10
      val count = completeAfterN(someComputations, localPlatform.graphStream).runToFuture(monixScheduler)
      execution.map {
        case ticker : TickBased => ticker.toDaemon()
        case _ => throw new IllegalArgumentException
      }.flatMap { daemon => count.flatMap {
          case `someComputations` => daemon.stop()
            var unsafeCount = 0
            localPlatform.graphStream.foreach(_ => unsafeCount += 1)(monixScheduler)
            wakeUpAfter(longWait).map { _ => unsafeCount shouldBe 0 }
          case _ => fail()
        }
      }
    }

    it("daemon delta change frequency") {
      val execution = localPlatform.loadScript(Script.javascript("rep(() => 0, x => x + 1)"))
      val delta = 50
      var unsafeTicks = 0L
      localPlatform.graphStream.foreach(_ => unsafeTicks += 1)(monixScheduler)
      var unsafeTimeWithoutDelta = 0L
      execution.map {
        case ticker : TickBased => ticker.toDaemon()
        case _ => throw new IllegalArgumentException
      }.flatMap { daemon => wakeUpAfter(longWait).flatMap{ _ =>
          unsafeTimeWithoutDelta = unsafeTicks
          daemon.stop().toDaemon(delta)
          unsafeTicks = 0
          wakeUpAfter(longWait).map(_ =>  unsafeTicks < unsafeTimeWithoutDelta shouldBe true)
        }
      }
    }
    it("batch size impact on changes in the graph") {
      val execution = localPlatform.loadScript(Script.javascript("rep(() => 0, x => x + 1)"))
      var unsafeList: List[Graph] = List.empty
      val tickTimes = 2
      val batchTickSize = 10
      val countNonBatched = completeAfterN(tickTimes, localPlatform.graphStream).runToFuture(monixScheduler)
      localPlatform.graphStream.foreach(graph => unsafeList = graph :: unsafeList)(monixScheduler)
      execution.foreach {
        case ticker : TickBased => execTickMultipleTimes(ticker, tickTimes).runToFuture(monixScheduler)
        case _ =>
      }
      val countFuture = countNonBatched.map(_ => countDifferences(unsafeList.head, unsafeList.tail.head) shouldBe 1)
      countFuture.flatMap { _ =>
        unsafeList = List.empty
        execution.foreach {
          case ticker : TickBased => execTickMultipleTimes(ticker.withBatchSize(batchTickSize), tickTimes).runToFuture(monixScheduler)
          case _ =>
        }
        completeAfterN(tickTimes, localPlatform.graphStream).runToFuture(monixScheduler)
      }.map {_ => countDifferences(unsafeList.head, unsafeList.tail.head) shouldNot be (1)}
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

  def completeAfterWithTime[E](elements : Int, source : Observable[E]) : Task[Long] = source.foldWhileLeft((System.currentTimeMillis, 0)){
    case ((time, `elements`), _) => Right((System.currentTimeMillis() - time, elements))
    case ((time, count), _) => Left((time, count + 1))
  }.map(_._1).lastL

  def execTickMultipleTimes(ticker : TickBased, times : Int) : Task[Unit] = Task.eval {
    (0 to times) foreach { _ => ticker.tick() }
  }

  def wakeUpAfter(time : Long) : Future[Unit] = {
    val promise = Promise[Unit]()
    scalajs.js.timers.setTimeout(time)(promise.success({}))
    promise.future
  }
}