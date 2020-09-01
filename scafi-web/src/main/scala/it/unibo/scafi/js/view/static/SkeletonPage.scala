package it.unibo.scafi.js.view.static

import org.scalajs.dom.html.{Button, Div, Select, TextArea}
import org.scalajs.dom.raw.HTMLStyleElement
import scalatags.JsDom.TypedTag
import scalatags.JsDom.all._
import scalatags.JsDom._
import scalacss.ScalatagsCss._
import CssSettings._
object SkeletonPage {
  lazy val renderedStyle = RootStyle.render[TypedTag[HTMLStyleElement]]
  lazy val editorSection : TextArea = textarea(id := "editor").render
  lazy val selectionProgram : Select = select(id := "selectProgram", cls := "form-control").render
  lazy val controlsDiv : Div = div(id := "controls").render
  lazy val visualizationSection : Div = div(id := "visualizationPane").render
  lazy val simulationConfiguration : Div = div(
    cls := "col-2 bg-dark",
    id := "simulationConfiguration"
  ).render
  //TODO find a good way to model bootstrap class (with a dedicated module?)
  val content : TypedTag[Div] = div(
    cls:= "container-fluid d-flex flex-column p-0",
    navBar,
    pageContainer
  )

  def navBar : Tag = tag("nav")(
    cls := "navbar navbar-dark bg-dark flex-shrink-0",
    span(
      cls := "navbar-brand",
      h1(
        cls := "text-light",
        "Scafi"
      )
    ),
    span(
      cls := "navbar-text",
      "Discover the power of the collective"
    )
  )

  def pageContainer : TypedTag[Div] = div(
    cls := "row flex-grow-1 m-0 pl-4 pr-2 bg-dark",
    id := "pageContainer",
    simulationConfiguration,
    editor,
    visualization
  )

  def editor : TypedTag[Div] = div(
    cls := "col-4 bg-dark",
    selectionProgram,
    editorSection
  )

  def visualization : TypedTag[Div] = div(
    cls := "col-6 bg-dark",
    id := "visualization",
    controlsDiv,
    visualizationSection
  )
}
