package it.unibo.scafi.js

import it.unibo.scafi.config.GridSettings

object WebIncarnationUtils {
  /**
   * a network composed by nine nodes arranged in a grid
   * 1 - 2 - 3
   * |   |   |
   * 4 - 5 - 6
   * |   |   |
   * 7 - 8 - 9
   */
  def network(): WebIncarnation.NETWORK = {
    val radius = 3
    val elements = 3
    val settings = GridSettings(
      nrows = elements,
      ncols = elements,
      stepx = radius,
      stepy = radius
    )
    WebIncarnation.simulatorFactory.gridLike(settings, radius)
  }
}
