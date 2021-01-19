package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.view.dynamic.graph.Interaction.{Pan, Selection}
import org.scalajs.dom.html.Label

/** The class models a button group wrapper for interaction buttons. */
class InteractionBoundButtonBar(interaction: Interaction) {
  //  def render(panMoveMode: Div): Unit = {
  //    panMoveMode.addEventListener("click", (_: Event) => {
  //      println($(s"input[type='radio'][name='$PanMoveModeFormName']:checked").value().toString)
  //      interaction.changeTo($(s"input[type='radio'][name='$PanMoveModeFormName']:checked").value().toString match {
  //        case MoveModeFormValue => Selection
  //        case PanModeFormValue => Pan
  //      })
  //    })
  //  }

  def render(panModeButton: Label, selectModeButton: Label): Unit = {
    panModeButton.onclick = e => interaction.changeTo(Pan)
    selectModeButton.onclick = e => interaction.changeTo(Selection)
  }
}

object InteractionBoundButtonBar {
  val PanMoveModeFormName = "control-mode";
  val PanModeFormValue = "move-mode";
  val MoveModeFormValue = "pan-mode";
}
