package it.unibo.scafi.js.controller.local

import java.util.NoSuchElementException

import it.unibo.scafi.js.{Utils}
import it.unibo.scafi.js.controller.local.SimulationExecution.{Continuously, TickBased}
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.model.{Graph, NaiveGraph}
import monix.eval.Task
import monix.execution.Scheduler.Implicits.global
import monix.reactive.Observable
import org.scalatest.BeforeAndAfterEach
import org.scalatest.funspec.AsyncFunSpec
import org.scalatest.matchers.should.Matchers

import scala.concurrent.{Future, Promise}
class SimulationExecutionTest extends AsyncFunSpec with Matchers with BeforeAndAfterEach {
  import SimulationExecutionTest._
  override implicit val executionContext = scala.concurrent.ExecutionContext.Implicits.global
  var localPlatform : SimulationSupport with SimulationExecutionPlatform = _
  val longWait = 100
  override def beforeEach(): Unit = {
    val (cols, rows, stepX, stepY, tolerance) = (10, 10, 20, 20, 0)
    val config = SupportConfiguration(
      GridLikeNetwork(cols, rows, stepX, stepY, tolerance),
      SpatialRadius(stepX),
      DeviceConfiguration.none,
      SimulationSeeds()
    )
    localPlatform = new SimulationSupport(config) with SimulationExecutionPlatform
  }
  import org.scalatest.concurrent.ScalaFutures._
  describe("Execution platform") {
    it("should support javascript script") {
      val result = localPlatform.loadScript(Script.javascript {"10"})
      result.map(_ => succeed)(Utils.timeoutBasedContext)
    }

    it("should check javascript error before creating execution") {
      val result = localPlatform.loadScript(Script.javascript("var u"))
      whenReady(result.failed) {
        case th: NoSuchElementException => fail(th)
        case th => succeed
      }
    }

    it("should support tick by tick execution") {
      val execution = localPlatform.loadScript(Script.javascript("rep(() => 0, x => x + 1)"))
      val ticksTimes = 10
      val count = completeAfterN(ticksTimes, localPlatform.graphStream).runToFuture
      whenReady(execution) {
        case ticker: TickBased => for {_ <- execTickMultipleTimes(ticker, ticksTimes)} //execute task and wait
          succeed
        case _ => fail()
      }
      whenReady(count) {
        case (`ticksTimes`) => succeed
        case _ => fail()
      }
    }

    it("continuously produce side effects") {
      val execution = localPlatform.loadScript(Script.javascript("rep(() => 0, x => x + 1)"))
      val someComputations = 100
      val count = completeAfterN(someComputations, localPlatform.graphStream).runToFuture
      var continuously: Continuously = null
      whenReady(execution) {
        case ticker: TickBased =>
          continuously = ticker.toContinuously()
          succeed
        case _ => fail()
      }
      count.map {
        case `someComputations` => continuously.stop()
          succeed
        case _ => fail()
      }(Utils.timeoutBasedContext)
    }

    it("continuously can be stopped") {
      val execution = localPlatform.loadScript(Script.javascript("rep(() => 0, x => x + 1)"))
      val someComputations = 10
      val count = completeAfterN(someComputations, localPlatform.graphStream).runToFuture
      var continuously: Continuously = null
      whenReady(execution) {
        case ticker: TickBased =>
          continuously = ticker.toContinuously()
          succeed
        case _ => fail()
      }
      count.flatMap {
        case `someComputations` => {
          continuously.stop()
          var unsafeCount = 0
          localPlatform.graphStream.foreach(_ => unsafeCount += 1)
          wakeUpAfter(longWait).map { _ => unsafeCount shouldBe 0 }(Utils.timeoutBasedContext)
        }
        case _ => fail()
      }(Utils.timeoutBasedContext)
    }

    it("continuously delta change frequency") {
      val execution = localPlatform.loadScript(Script.javascript("rep(() => 0, x => x + 1)"))
      val delta = 10
      var unsafeTicks = 0L
      localPlatform.graphStream.foreach(_ => unsafeTicks += 1)
      var continuously: Continuously = null
      var unsafeTimeWithoutDelta = 0L

      whenReady(execution) {
        case ticker: TickBased =>
          continuously = ticker.toContinuously()
        case _ => fail()
      }
      wakeUpAfter(longWait).flatMap{ _ =>
        continuously.stop().toContinuously(delta)
        unsafeTimeWithoutDelta = unsafeTicks
        unsafeTicks = 0
        wakeUpAfter(longWait).map(_ =>  unsafeTicks < unsafeTimeWithoutDelta shouldBe true)(Utils.timeoutBasedContext)
      }(Utils.timeoutBasedContext)
    }

    it("batch size impact on changes in the graph") {
      val execution = localPlatform.loadScript(Script.javascript("rep(() => 0, x => x + 1)"))
      var unsafeList: List[Graph] = List.empty
      val tickTimes = 2
      val batchTickSize = 10
      val countNonBatched = completeAfterN(tickTimes, localPlatform.graphStream).runToFuture
      localPlatform.graphStream.foreach(graph => unsafeList = graph :: unsafeList)

      whenReady(execution) {
        case ticker : TickBased => for( _ <- execTickMultipleTimes(ticker, tickTimes) )
          succeed
        case _ => fail()
      }

      whenReady(countNonBatched) {
        _ => countDifferences(unsafeList.head, unsafeList.tail.head) shouldBe 1
      }

      unsafeList = List.empty
      val countBatched = completeAfterN(2, localPlatform.graphStream).runToFuture
      whenReady(execution) {
        case ticker : TickBased => for( _ <- execTickMultipleTimes(ticker.copy(batchSize = batchTickSize), tickTimes) )
          succeed
        case _ => fail()
      }

      whenReady(countBatched) {
        _ => countDifferences(unsafeList.head, unsafeList.tail.head) shouldNot be(1)
      }
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