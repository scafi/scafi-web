package it.unibo.scafi.js

import it.unibo.scafi.js.utils.Cookie
import it.unibo.scafi.js.view.dynamic.{Popover, PopoverProgression, SimulationControlsSection}
import it.unibo.scafi.js.view.static.SkeletonPage

object Tour {
  def apply(controls: SimulationControlsSection): PopoverProgression.Builder = SkeletonPage.popoverTourBuilder
    .addNextPopover(
      attachTo = controls.loadButton.id,
      title = "Load code",
      text = "Every time you edit your code and want to load it onto the network, click here ...",
      direction = Popover.Bottom
    )
    .addNextPopover(
      attachTo = controls.startButton.id,
      title = "Start the simulation",
      text = "... and then start the simulation here"
    )
    .addNextPopover(
      attachTo = controls.stopButton.id,
      title = "Stop the simulation",
      text = "You can stop the simulation with this button to restart it later."
    )
    .addNextPopover(
      attachTo = controls.tick.id,
      title = "Tick-by-tick progression",
      text = "You can also progress in the simulation tick-by-tick using this button."
    )
    // TODO add batch description
    // TODO add period description
    .andFinally(() => Cookie.store("visited", "true"))
}
