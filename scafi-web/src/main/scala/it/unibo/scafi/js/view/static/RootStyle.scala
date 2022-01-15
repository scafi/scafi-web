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

  "#control-mode-container" - (
    position.relative,
    top(-55 px),
    width(0 px),
    left(50 %%)
  )
  ".simplebar-scrollbar::before" - (backgroundColor(gray))

  ".carousel-control" - (filter := "invert(1);")

  ".gutter" - (
    backgroundRepeat.noRepeat,
    backgroundPosition := "50%"
  )
  ".gutter.gutter-horizontal" - (
    height(contentHeight),
    backgroundImage := s"${StringIcon.horizontalDivider}"
  )
}

object RootStyle extends StyleSheet.Standalone {

  import dsl._

  val maxVh = 100
  val standardNavHeight = 10
  val standardBottomBarHeight = 5

  val primaryBtnClass = "btn btn-primary"
  def primaryBtnClass(and: String): String = primaryBtnClass + " " + and
  val smallPrimaryBtnClass: String = primaryBtnClass("btn-sm")
  def smallPrimaryBtnClass(and: String): String = smallPrimaryBtnClass + " " + and

  case class Measure(
      navHeight: Length[Int],
      pageContentHeight: Length[Int],
      contentHeight: Length[Int],
      visualizationHeight: Length[Int],
      editorHeight: Length[Int],
      demoSelectionHeight: Length[Int],
      utilsVisualizationHeight: Length[Int]
  )

  def withNav(nav: Int = standardNavHeight): RootStyle = {
    val measure = Measure(
      navHeight = nav vh,
      pageContentHeight = (maxVh - nav) vh,
      contentHeight = 87 vh,
      visualizationHeight = 77 vh,
      editorHeight = 82 vh,
      demoSelectionHeight = 5 vh,
      utilsVisualizationHeight = 5 vh
    )
    RootStyle(measure)
  }

  def withoutNav(): RootStyle = {
    val measure = Measure(
      navHeight = 0 vh,
      pageContentHeight = maxVh vh,
      contentHeight = 97 vh,
      visualizationHeight = 87 vh,
      editorHeight = 92 vh,
      demoSelectionHeight = 5 vh,
      utilsVisualizationHeight = 5 vh
    )
    RootStyle(measure)
  }
}
