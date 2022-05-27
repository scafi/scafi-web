package it.unibo.scafi.js.dsl.typeclass

import scala.scalajs.js.annotation.JSExportAll

@JSExportAll
trait OrderedJs[A] {
  def compare(a: A, b: A): Int
  def same(a: A, b: A): Boolean = compare(a, b) == 0
  def min(a: A, b: A): A = if (compare(a, b) <= 0) a else b
  def max(a: A, b: A): A = if (compare(a, b) > 0) a else b
}
