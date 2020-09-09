package it.unibo.scafi.js.view.static
import CssSettings._
import scalacss.internal.Attr
import scalacss.internal.ValueT.TypedAttrBase

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport

/**
  * The css main file of the page, it contains the main tag and id that need to be styled
  */
object RootStyle extends StyleSheet.Standalone {
  import dsl._

  private val navHeight = 8 vh
  private val pageContentHeight = 90 vh
  private val contentHeight = 88 vh
  private val visualizationHeight = 78 vh
  private val editorHeight = 84 vh
  val utilsVisualizationHeight = 5 vh

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

  "#visualization-section, #editor-section, #backend-config-section" - (height(contentHeight))

  "backendConfig" -(overflow.auto)

  "#controls, #visualization-option" -(
    height(utilsVisualizationHeight),
    whiteSpace.nowrap
  )

  "#console" -(height(utilsVisualizationHeight))

  "#visualization-pane" - (
    height(visualizationHeight),
    outlineWidth(0 px)
  )

  "#page-container" -(height(pageContentHeight))

  ".simplebar-scrollbar::before" -(backgroundColor(gray))

  ".carousel-control" -(filter := "invert(1);")
}
