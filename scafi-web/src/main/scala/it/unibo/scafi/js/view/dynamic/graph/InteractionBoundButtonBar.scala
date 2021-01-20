package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.view.dynamic.graph.Interaction.{Pan, Selection}
import org.scalajs.dom.html.Label

/** The class models a button group wrapper for interaction buttons. */
class InteractionBoundButtonBar(interaction: Interaction) {

  def render(panModeButton: Label, selectModeButton: Label): Unit = {
    panModeButton.onclick = _ => interaction.changeTo(Pan)
    selectModeButton.onclick = _ => interaction.changeTo(Selection)
  }
}

object InteractionBoundButtonBar {
  val PanMoveModeFormName = "control-mode";
  val PanModeFormValue = "move-mode";
  val MoveModeFormValue = "pan-mode";
}
