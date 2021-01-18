package it.unibo.scafi.js.view.static

import it.unibo.scafi.js.view.static.CssSettings._
import it.unibo.scafi.js.view.static.RootStyle.Measure
import scalacss.internal.Length

import scala.language.postfixOps

/** The css main file of the page, it contains the main tag and id that need to be styled. */
case class RootStyle(measures: Measure) extends StyleSheet.Standalone {

  import dsl._
  import measures._

  "html, body" - (height(100 %%))
  "nav" - (height(navHeight))

  "#editor" - (
    height(100 %%),
    paddingBottom(10 px),
    flex := "1 1 auto",
    position.relative,
    overflow.auto
  )
  "#editor-header" - (height(demoSelectionHeight))
  "#select-program, #select-mode" - (height(100 %%))

  ".CodeMirror" - (height(editorHeight).important)

  "#visualization-section, #editor-section, #backend-config-section" - (height(contentHeight))

  "backendConfig" - (overflow.auto)

  "#controls, #visualization-option" - (
    height(utilsVisualizationHeight),
    whiteSpace.nowrap
  )

  "#console" - (height(utilsVisualizationHeight))

  "#visualization-pane" - (
    height(visualizationHeight),
    outlineWidth(0 px)
  )

  "#page-container" - (height(pageContentHeight))

  ".simplebar-scrollbar::before" - (backgroundColor(gray))

  ".carousel-control" - (filter := "invert(1);")

  ".btn-floating-group" - (

  )

  /*".btn-group-fab" - (
    position.fixed,
    width(50 px),
    height.auto,
    right(20 px),
    bottom(20 px)
  )

  ".btn-group-fab div" - (
    position.relative,
    width(100 %%),
    height.auto
  )

  ".btn-group-fab .btn" - (
    position.absolute,
    bottom(0 px),
    borderRadius(50 %%),
    display.block,
    marginBottom(4 px),
    width(40 px),
    height(40 px),
    marginTop(4 px),
    marginBottom(4 px),
    marginLeft.auto,
    marginRight.auto
  )

  ".btn-group-fab .btn-main" - (
    width(50 px),
    height(50 px),
    right(50 %%),
    marginRight(-25 px),
    zIndex(9)
  )

  ".btn-group-fab .btn-sub" - (
    bottom(0 px),
    zIndex(8),
    right(50 %%),
    transition := "all 0.5s",
  )

  ".btn-group-fab.active .btn-sub:nth-child(2)" - (
    bottom(60 px)
  )

  ".btn-group-fab.active .btn-sub:nth-child(3)" - (
    bottom(110 px)
  )

  ".btn-group-fab.active .btn-sub:nth-child(4)" - (
    bottom(160 px)
  )

  ".btn-group-fab .btn-sub:nth-child(5)" - (
    bottom(210 px)
  )*/
}

object RootStyle extends StyleSheet.Standalone {

  import dsl._

  val maxVh = 100
  val standardNavHeight = 10
  val standardBottomBarHeight = 5

  case class Measure(navHeight: Length[Int],
                     pageContentHeight: Length[Int],
                     contentHeight: Length[Int],
                     visualizationHeight: Length[Int], editorHeight: Length[Int],
                     demoSelectionHeight: Length[Int], utilsVisualizationHeight: Length[Int])

  def withNav(nav: Int = standardNavHeight, bottomBar: Int = standardBottomBarHeight): RootStyle = {
    val measure = Measure(
      navHeight = nav vh,
      pageContentHeight = (maxVh - nav) vh,
      contentHeight = 86 vh,
      visualizationHeight = (76 - bottomBar) vh,
      editorHeight = 81 vh,
      demoSelectionHeight = 5 vh,
      utilsVisualizationHeight = 5 vh
    )
    RootStyle(measure)
  }

  def withoutNav(bottomBar: Int = standardBottomBarHeight): RootStyle = {
    val measure = Measure(
      navHeight = 0 vh,
      pageContentHeight = maxVh vh,
      contentHeight = 96 vh,
      visualizationHeight = (86 - bottomBar) vh,
      editorHeight = 91 vh,
      demoSelectionHeight = 5 vh,
      utilsVisualizationHeight = 5 vh
    )
    RootStyle(measure)
  }
}
