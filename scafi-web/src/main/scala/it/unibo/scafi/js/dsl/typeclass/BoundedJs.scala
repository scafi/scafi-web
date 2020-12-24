package it.unibo.scafi.js.dsl.typeclass

import scala.scalajs.js.annotation.JSExportAll

@JSExportAll
trait BoundedJs[A] extends OrderedJs[A] {
  def top : A
  def bottom : A
}
