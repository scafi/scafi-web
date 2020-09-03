package it.unibo.scafi.js.view.static

import org.scalajs.dom.html.{Button, Div, Select, TextArea}
import org.scalajs.dom.raw.HTMLStyleElement
import scalatags.JsDom.TypedTag
import scalatags.JsDom.all._
import scalatags.JsDom._
import scalacss.ScalatagsCss._
import CssSettings._

/**
 * the skeleton page of this web site. it contains the main dom element (editor, visualization, configuration)
 */
object SkeletonPage {
  //TODO find a good way to model bootstrap class (with a dedicated module?)
  /**
   * the root style of the web page.
   */
  lazy val renderedStyle = RootStyle.render[TypedTag[HTMLStyleElement]]
  /**
   * textarea associated with the editor section.
   */
  lazy val editorSection : TextArea = textarea(id := "editor").render
  /**
   * select part to choose an aggregate program.
   */
  lazy val selectionProgram : Select = select(id := "selectProgram", cls := "form-control").render
  /**
   * section that contains the controls to manage the backend, it is support specific.
   */
  lazy val controlsDiv : Div = div(id := "controls").render
  /**
   * section in which is rendered the graph that represent the aggregate system.
   */
  lazy val visualizationSection : Div = div(id := "visualizationPane", cls := "border border-secondary", tabindex := 0).render
  /**
   * section used to configure the backend (it is support specific)
   */
  lazy val backendConfig : Div = div(cls := "col-2 bg-dark", id := "backend-config-section").render
  /**
   * the entirely page content.
   */
  val content : TypedTag[Div] = div(
    cls:= "container-fluid d-flex flex-column p-0 bg-dark",
    navBar,
    pageContainer
  )

  private def navBar : Tag = tag("nav")(
    cls := "navbar navbar-dark flex-shrink-0 mb-3 bg-secondary",
    span(
      cls := "navbar-brand",
      h1(cls := "text-light", "Scafi")
    ),
    span(
      cls := "navbar-text",
      "Discover the power of the collective"
    )
  )

  private def pageContainer : TypedTag[Div] = div(
    cls := "row flex-grow-1 m-0 bg-dark",
    id := "pageContainer",
    backendConfig,
    editor,
    visualization
  )

  private def editor : TypedTag[Div] = div(
    cls := "col-4 bg-dark",
    id := "editor-section",
    selectionProgram,
    editorSection
  )

  private def visualization : TypedTag[Div] = div(
    cls := "col-6 bg-dark",
    id := "visualization-section",
    controlsDiv,
    visualizationSection
  )
}
