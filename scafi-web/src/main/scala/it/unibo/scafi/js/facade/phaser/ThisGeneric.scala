package it.unibo.scafi.js.facade.phaser

/**+
  * utility when you define a concrete class mixed in with This. It define the generic This with the concrete class
  * value.
  * @tparam T the concrete type of This
  */
trait ThisGeneric[T <: ThisGeneric[T]] extends This {
  override type This = T
}
