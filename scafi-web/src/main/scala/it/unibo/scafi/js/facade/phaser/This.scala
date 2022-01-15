package it.unibo.scafi.js.facade.phaser

import scala.scalajs.js

/** This interface allows to have the reference to the type of oneself dependent on the child classes. For example, if I
  * want to define a method: def setX(..) : ChildType. using this interface you define as follow: def setX(..) : This.
  * The class that extends this trait it should override the type This: override type This = Me or mixin with
  * ThisGeneric: trait A extends This class B extends This with ThisGeneric[B]
  */
trait This extends js.Any {
  import it.unibo.scafi.js.facade.phaser.{This => ThisInterface}
  type This <: ThisInterface
}
