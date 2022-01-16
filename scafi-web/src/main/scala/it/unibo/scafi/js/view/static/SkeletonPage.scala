package it.unibo.scafi.js.view.static

import it.unibo.scafi.js.view.dynamic.{Popover, PopoverProgression}
import it.unibo.scafi.js.view.dynamic.graph.InteractionBoundButtonBar.{
  MoveModeFormValue,
  PanModeFormValue,
  PanMoveModeFormName
}
import it.unibo.scafi.js.view.static.CssSettings._
import it.unibo.scafi.js.view.static.RootStyle.primaryBtnClass
import org.scalajs.dom.html.{Div, Form, Label, Select, TextArea}
import org.scalajs.dom.raw.HTMLStyleElement
import scalacss.ScalatagsCss._
import scalatags.JsDom.TypedTag
import scalatags.JsDom.all._

/** The skeleton page of this web site. It contains the main dom elements: editor, visualization and configuration.
  */
object SkeletonPage {
  // TODO find a good way to model bootstrap class (with a dedicated module?)
  /** The root style of the web page. */
  def renderedStyle(style: RootStyle): TypedTag[HTMLStyleElement] = {
    val result = style.render[TypedTag[HTMLStyleElement]]
    result(id := "main-style")
  }

  /** Textarea associated with the editor section. */
  lazy val editorSection: Div = div(id := "editor").render

  /** Select part to choose an aggregate program. */
  lazy val selectionProgram: Select = select(
    id  := "select-program",
    cls := "form-control bg-dark text-light"
  ).render
  private val modeSelectionId = "advanced-toggle";

  /** Section that contains the controls to manage the backend, it is support specific. */
  lazy val controlsDiv: Div = div(id := "controls").render

  /** Section that contains some visualization configuration (e.g. font size, node size, ...) */
  lazy val visualizationConfigDropdown: Div =
    div(cls := "form-group", id := "viz-setting-dropdown").render

  /** Editor header that contains the program and mode selector */
  lazy val editorHeader: Div = div(
    id  := "editor-header",
    cls := "input-group input-group-sm pt-1 pb-1",
    div(
      cls := "input-group-prepend",
      span(cls := "input-group-text", "Examples")
    ),
    selectionProgram
  ).render
  lazy val editorHeaderPopover = new Popover(
    attachTo = editorHeader.id,
    title = "Examples",
    data = p("Here you can select a ScaFi example").render,
    direction = Popover.Bottom
  )
  lazy val popoverTourBuilder: PopoverProgression.Builder = PopoverProgression
    .Builder()
    .addNextPopover(
      attachTo = editorHeader.id,
      title = "Code editor",
      text = "With this selector you can choose a ScaFi example and edit it in the editor below"
    )
    .addNextPopover(
      attachTo = modeSelectionId,
      title = "Advanced mode",
      text = """In basic mode, you can write directly ScaFi code, without worrying about producing valid Scala code.
        |If you are not a beginner and you want more control on the produced Scala code, enable this toggle.""".stripMargin
    )
    .addNextPopover(
      attachTo = backendConfig.id,
      title = "Backend configuration",
      text = """Here you can tune the settings about the network of virtual devices the program is deployed onto,
        |like spatial deployment and sensors accessible in code.
        |""".stripMargin,
      direction = Popover.Right
    )

  /** Section that contains the controls to manage the visualization, it is support specific. */
  lazy val visualizationOptionDiv: Div =
    div(id := "visualization-option", `class` := "form-inline").render

  /** Section in which is rendered the graph that represent the aggregate system. */
  lazy val visualizationSection: Div = div(
    id       := "visualization-pane",
    cls      := "border border-secondary",
    tabindex := 0
  ).render

  lazy val navRightSide: Form = form(
    cls := "form-inline",
    div(
      cls := "dropdown",
      span(
        cls            := "btn btn-outline-light mr-2 my-sm-0 dropdown-toggle",
        data("toggle") := "dropdown",
        aria.haspopup  := true,
        aria.expanded  := false,
        span(cls := "fas fa-cogs fa-lg pr-2", aria.hidden := true),
        "Settings"
      ),
      form(
        cls := "dropdown-menu bg-dark p-2 text-white",
        visualizationConfigDropdown
      )
    ),
    a(
      cls    := "btn btn-outline-light mr-2 my-sm-0",
      href   := "https://scafi.github.io/",
      target := "_blank",
      rel    := "noopener noreferrer",
      i(cls := "fas fa-globe fa-lg pr-2", aria.hidden := true),
      "Website"
    ),
    a(
      cls    := "btn btn-outline-light my-2 my-sm-0",
      href   := "https://github.com/scafi/scafi",
      target := "_blank",
      rel    := "noopener noreferrer",
      i(cls := "fab fa-github fa-lg pr-2", aria.hidden := true),
      "Repository"
    ),
    a(
      cls    := "btn btn-outline-light ml-2 my-sm-0",
      href   := "https://youtu.be/E-EoFmm5tuc",
      target := "_blank",
      rel    := "noopener noreferrer",
      i(cls := "fab fa-youtube fa-lg", aria.hidden := true)
    )
  ).render

  /** Section used to configure the backend (it is support specific) */
  lazy val backendConfig: Div = div(
    cls := "bg-dark",
    id  := "backend-config-section",
    h3(cls := "text-light", "Backend configuration")
  ).render

  /** The entirely page content. */
  val fullPage: TypedTag[Div] = div(
    cls := "container-fluid d-flex flex-column p-0 bg-dark",
    navBar,
    pageContainer
  )

  /** The main section of the page. */
  val contentOnly: TypedTag[Div] =
    div(cls := "container-fluid d-flex flex-column p-0 bg-dark", pageContainer)

  private def navBar: Tag = tag("nav")(
    cls := "navbar navbar-dark flex-shrink-0 bg-secondary",
    span(cls := "navbar-brand", h1(cls := "text-light", "Scafi")),
    span(cls := "navbar-text ml-2", "Discover the power of the collective"),
    navRightSide
  )

  private def pageContainer: TypedTag[Div] = div(
    cls := "row m-0 bg-dark pt-3",
    id  := "page-container",
    backendConfig,
    editor,
    visualization
  )

  private def editor: TypedTag[Div] =
    div(cls := "bg-dark", id := "editor-section", editorHeader, editorSection)

  private def visualization: TypedTag[Div] = div(
    cls := "bg-dark",
    id  := "visualization-section",
    controlsDiv,
    visualizationOptionDiv,
    visualizationSection,
    panMoveMode // todo
  )

  lazy val selectModeButton: Label = label(
    `class` := primaryBtnClass,
    input(
      `type` := "radio",
      name   := PanMoveModeFormName,
      id     := MoveModeFormValue,
      value  := MoveModeFormValue
    ),
    i(
      id          := "move-toggle",
      cls         := "fas fa-mouse-pointer fa-lg",
      aria.hidden := true
    )
  ).render

  lazy val panModeButton: Label = label(
    `class` := primaryBtnClass("active"),
    input(
      `type`  := "radio",
      name    := PanMoveModeFormName,
      id      := PanModeFormValue,
      value   := PanModeFormValue,
      checked := true
    ),
    i(
      id          := "pan-toggle",
      cls         := "fas fa-hand-paper fa-lg",
      aria.hidden := true
    )
  ).render

  // toggle as button group
  lazy val panMoveMode: Div = div(
    cls := "btn-floating-group text-center pt-2",
    id  := PanMoveModeFormName + "-container",
    div(
      cls            := "btn-group btn-group-toggle",
      id             := PanMoveModeFormName,
      data("toggle") := "buttons",
      aria.label     := "Change control mode",
      panModeButton,
      selectModeButton
    )
  ).render
}
