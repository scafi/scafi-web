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

  private val navHeight = 12 vh
  private val pageContentHeight = 88 vh
  private val contentHeight = 86 vh
  private val visualizationHeight = 80 vh
  private val editorHeight = 82 vh
  private val utilsVisualizationHeight = 6 vh

  object scrollbarWidth extends TypedAttrBase {
    override val attr: Attr = Attr.real("scrollbar-width")
    def thin = av("thin")
  }
  "html, body" - (
    height(100 %%),
    scrollbarWidth.thin
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
    height(utilsVisualizationHeight),
    /*overflowX.auto,
    overflowY.hidden,*/
    whiteSpace.nowrap
  )

  "#console" -(
    height(utilsVisualizationHeight)
  )

  "#visualizationPane" - (
    margin(1 px),
    height(visualizationHeight),
    outlineWidth(0 px)
  )

  "#pageContainer" -(
    height(pageContentHeight)
  )

  ".simplebar-scrollbar::before" -(
    backgroundColor(white)
  )
}
