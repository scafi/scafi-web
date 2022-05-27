package it.unibo.scafi.js.dsl.semantics

import it.unibo.scafi.incarnations.Incarnation
import it.unibo.scafi.js.dsl.{JF1, ScafiInterpreterJs}
import it.unibo.scafi.lib.StandardLibrary
import scala.scalajs.js.annotation.JSExportAll
@JSExportAll
trait BlockTJs {
  self: ScafiInterpreterJs[_ <: Incarnation with StandardLibrary] =>
  private val eval = new SharedInterpreter() with incarnation.BlockT
  def T(initial: Double, floor: Double, decay: JF1[Double, Double]): Unit =
    eval.T[Double](initial, floor, v => decay(v))
  def timer(length: Double): Double = eval.timer(length)
  def sharedTimerWithDecay(period: Double, dt: Double): Double = eval.sharedTimerWithDecay(period, dt)
  def cyclicTimerWithDecay(length: Double, decay: Double): Boolean = eval.cyclicTimerWithDecay(length, decay)
  def clock(length: Double, decay: Double): Unit = eval.clock(length, decay)
  def impulsesEvery(d: Double): Boolean = eval.impulsesEvery(d)
  def limitedMemory[T](value: T, expValue: T, timeout: Double): Unit = eval.limitedMemory(value, expValue, timeout)
}
