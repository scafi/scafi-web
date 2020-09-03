package it.unibo.scafi.js.facade.phaser

trait ThisGeneric[T <: ThisGeneric[T]] extends This {
  override type This = T
}
