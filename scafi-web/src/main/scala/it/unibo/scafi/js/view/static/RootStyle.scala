package it.unibo.scafi.js.view.static
import CssSettings._
import scalacss.internal.Attr
import scalacss.internal.ValueT.TypedAttrBase

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport

/**
  * the css main file of the page, it contains the main tag and id that need to be styled
  */
object RootStyle extends StyleSheet.Standalone {
  import dsl._

  private val navHeight = 8 vh
  private val pageContentHeight = 90 vh
  private val contentHeight = 88 vh
  private val visualizationHeight = 82 vh
  private val editorHeight = 84 vh
  private val utilsVisualizationHeight = 6 vh

  "html, body" - (height(100 %%))
  "nav" -(height(navHeight))

  "#editor" - (
    height(100 %%),
    paddingBottom(10 px),
    flex := "1 1 auto",
    position.relative,
    overflow.auto
  )

  ".CodeMirror" - (height(editorHeight).important)

  "#canvasContainer" - (height(contentHeight))

  "#visualization-section, #editor-section, #backend-config-section" - (height(contentHeight))

  "backendConfig" -(overflow.auto)

  "#controls" -(
    height(utilsVisualizationHeight),
    whiteSpace.nowrap
  )

  "#console" -(height(utilsVisualizationHeight))

  "#visualizationPane" - (
    height(visualizationHeight),
    outlineWidth(0 px)
  )

  "#pageContainer" -(height(pageContentHeight))

  ".simplebar-scrollbar::before" -(backgroundColor(white))
}
