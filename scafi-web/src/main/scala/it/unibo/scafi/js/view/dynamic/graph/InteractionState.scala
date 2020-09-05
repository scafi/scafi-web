package it.unibo.scafi.js.view.dynamic.graph

sealed private[graph] trait InteractionState
object InteractionState {
  private[graph] case object MoveWorld extends InteractionState
  private[graph] case object MoveSelection extends InteractionState
  private[graph] case object OnSelection extends InteractionState
  private[graph] case object Idle extends InteractionState
}