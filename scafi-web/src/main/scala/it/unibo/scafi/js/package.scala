package it.unibo.scafi

import scala.scalajs.js.|
package object js {
  type JSNumber = Double
  type Nullable[A] = A | Null

  implicit class NullableOps[A](value : Nullable[A]) {
    @inline def isDefined: Boolean = value != null

    @inline private def forceGet: A = value.asInstanceOf[A]

    @inline def get: A =
      if (isDefined) forceGet
      else throw new NoSuchElementException("null")

    @inline def fold[B](ifEmpty: => B)(f: A => B): B =
      if (isDefined) f(forceGet)
      else ifEmpty

    @inline def map[B](f: A => B): B | Null =
      fold[B | Null](null)(f(_))

    @inline def getOrElse[B >: A](ifEmpty: => B): B =
      fold[B](ifEmpty)(identity)

    @inline def toOption : Option[A] = Option(forceGet)
  }

}
