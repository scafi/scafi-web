package it.unibo.scafi.js

object FSM {
  trait State {
    protected[FSM] def onEnter() : Unit
    def evolve(state : State) : State = {
      state.onEnter()
      state
    }
  }
  def state(entering :  => Unit) : State = () => entering
  def start(state : State): Unit = state.onEnter()
}
