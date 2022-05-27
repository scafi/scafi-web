package it.unibo.scafi.js

import org.querki.jquery.$
import org.scalajs.dom.raw.HTMLElement

import java.util.UUID
import scala.scalajs.js
import scala.scalajs.js.|

package object utils {
  /** use internally json.stringify
    * @param element
    *   the element to parse in JSON
    * @tparam E
    *   object type
    * @return
    *   the string representation of the object
    */
  def stringify[E](element: E): String = {
    val any: js.Any = element.asInstanceOf[js.Any]
    js.Dynamic.global.JSON.stringify(any).toString
  }

  /** verify if an id exist in the page
    * @param id
    *   the id to search
    * @return
    *   true if the element is in the DOM false otherwise
    */
  def exist(id: String): Boolean = $(s"#$id").length > 0

  /** append an element only once time through the page life
    * @param where
    *   the element should be appended
    * @param element
    *   the element to append
    */
  def appendOnce(where: HTMLElement, element: HTMLElement): Unit = {
    if (!exist(element.id)) {
      where.appendChild(element)
    }
  }
  /** a declarative way to define the interface of facade. */
  type JSNumber = Double
  /** each type can be nullable, it is a way to define the interface of javascript library */
  type Nullable[A] = A | Null

  /** the operation that could be performed with Nullable type */
  implicit class NullableOps[A](value: Nullable[A]) {
    /** verify if the value is defined or not
      * @return
      *   true if the value is not null, false otherwise
      */
    @inline def isDefined: Boolean = value != null

    /** @return the value or throw NoSuchElementException("null"). */
    @inline def get: A = if (isDefined) forceGet else throw new NoSuchElementException("null")

    /** fold operation like Option.fold[B].
      * @param ifEmpty
      *   the function called if nullable is null
      * @param f
      *   the function called if nullable is some
      * @tparam B
      *   the output type
      * @return
      *   the result of ifEmpty if nullable is null f otherwise
      */
    @inline def fold[B](ifEmpty: => B)(f: A => B): B = if (isDefined) f(forceGet) else ifEmpty

    /** map operation like Option.map[B]
      * @param f
      *   the mapping function to act only if nullable is defined
      * @tparam B
      *   the result type of mapping operation
      * @return
      *   null is isn't defined f(value) otherwise
      */
    @inline def map[B](f: A => B): B | Null = fold[B | Null](null)(f(_))

    /** get or else like Option.getOrElse[B].
      * @param ifEmpty
      *   value in case of the Nullable is null.
      * @tparam B
      *   the result type of get or else.
      * @return
      *   ifEmpty if the nullable isn't defined, value otherwise
      */
    @inline def getOrElse[B >: A](ifEmpty: => B): B = fold[B](ifEmpty)(identity)

    /** @return convert the nullable type into the option type */
    @inline def toOption: Option[A] = Option(forceGet)

    /** like Option.foreach
      * @param f
      *   the function called if the nullable is defined
      */
    @inline def foreach(f: A => Unit): Unit = toOption.foreach(f)

    @inline private def forceGet: A = value.asInstanceOf[A]
  }
}
