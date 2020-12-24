package it.unibo.scafi.js.dsl.semantics

import it.unibo.scafi.incarnations.Incarnation
import it.unibo.scafi.js.dsl.ScafiInterpreterJs
import it.unibo.scafi.lib.StandardLibrary
import scala.concurrent.duration.FiniteDuration
import scala.scalajs.js
import scala.scalajs.js.annotation.JSExportAll
import scala.util.Random
@JSExportAll
trait StandardSensorJs {
  self : ScafiInterpreterJs[_ <: Incarnation with StandardLibrary] =>
  import incarnation._
  implicit def point3DtoJarray(p : incarnation.P) : js.Array[Double] = js.Array(p.x, p.y, p.z)
  private val eval = new SharedInterpreter with StandardSensors
  def nbrDelay(): FiniteDuration = eval.nbrDelay()
  def nbrLag(): FiniteDuration = eval.nbrLag()
  def nbrRange(): Double = eval.nbrRange()
  def nbrVector(): js.Array[Double] = eval.nbrVector()
  def currentPosition(): js.Array[Double] = eval.currentPosition()
  def timestamp(): Long = eval.timestamp()
  def deltaTime(): FiniteDuration = eval.deltaTime()
  def randomGenerator(): Random = eval.randomGenerator()
  def nextRandom(): Double = eval.nextRandom()
}
