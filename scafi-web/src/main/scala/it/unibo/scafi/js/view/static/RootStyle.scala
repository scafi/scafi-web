package it.unibo.scafi.js.view.static
import CssSettings._

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport

object RootStyle extends StyleSheet.Standalone {
  import dsl._

  private val navHeight = 12 vh
  private val pageContentHeight = 88 vh
  private val contentHeight = 86 vh
  private val visualizationHeight = 81 vh
  private val editorHeight = 82 vh
  private val utilsVisualizationHeight = 5 vh

  "html, body" - (
    height(100 %%)
  )
  "nav" -(
    height(navHeight)
  )

  "#editor" - (
    height(100 %%),
    paddingBottom(10 px),
    flex := "1 1 auto",
    position.relative
  )

  ".CodeMirror" - (
    height(editorHeight).important,
  )

  "#canvasContainer" - (
    height(contentHeight)
  )

  "#visualization, #canvasContainer, #simulationConfiguration " - (
    height(contentHeight)
  )

  "#controls" -(
    height(utilsVisualizationHeight)
  )

  "#console" -(
    height(utilsVisualizationHeight)
  )

  "#visualizationPane" - (
    margin(1 px),
    height(visualizationHeight)
  )

  "#pageContainer" -(
    height(pageContentHeight)
  )

  "canvas" -(
    height(100 %%),
    width(100 %%),
  )
}
