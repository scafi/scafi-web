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
  private val navHeight = 10 vh
  private val pageContentHeight = (100 - navHeight.n) vh
  private val contentHeight = 86 vh
  private val visualizationHeight = 76 vh
  private val editorHeight = 83 vh
  private val demoSelectionHeight = (contentHeight.n - editorHeight.n) vh
  private val utilsVisualizationHeight = 5 vh

  "html, body" - (height(100 %%))
  "nav" -(height(navHeight))

  "#editor" - (
    height(100 %%),
    paddingBottom(10 px),
    flex := "1 1 auto",
    position.relative,
    overflow.auto
  )

  "select-program" - (height(demoSelectionHeight))

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
