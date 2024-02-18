package it.unibo.scafi.js
import upickle.default._
import it.unibo.scafi.js.code.{ExampleGroup, _}
import it.unibo.scafi.js.controller.local
import it.unibo.scafi.js.controller.local._
import it.unibo.scafi.js.dsl.semantics._
import it.unibo.scafi.js.dsl.{BasicWebIncarnation, ScafiInterpreterJs, WebIncarnation}
import it.unibo.scafi.js.utils.{Cookie, Execution, appendOnce}
import it.unibo.scafi.js.view.dynamic._
import it.unibo.scafi.js.view.dynamic.graph.LabelRender.{LabelRender, MatrixLedRender, TextifyBitmap}
import it.unibo.scafi.js.view.dynamic.graph.{Interaction, InteractionBoundButtonBar, PhaserGraphSection}
import it.unibo.scafi.js.view.static.{PageStructure, RootStyle, SkeletonPage}
import monix.execution.Scheduler
import org.scalajs.dom.experimental.URLSearchParams

import java.util.concurrent.TimeUnit
import scala.concurrent.duration.FiniteDuration
import scala.scalajs.js.annotation.{JSExport, JSExportTopLevel}

/** Root object, it initialize the simulation, the page and the backend. */
object Index {

  import org.scalajs.dom._
  implicit val incarnation: BasicWebIncarnation = WebIncarnation // incarnation chosen

  /** Interpreter chosen. */
  @JSExportTopLevel("Lang")
  implicit val languageJsInterpreter: ScafiInterpreterJs[BasicWebIncarnation] =
    new ScafiInterpreterJs("Lang") with BlockGJs with LanguageJs with BlockTJs with StandardSensorJs with BuiltinsJs

  val configuration: SupportConfiguration = SupportConfiguration(
    GridLikeNetwork(10, 10, 40, 40, 5),
    SpatialRadius(range = 70),
    deviceShape = DeviceConfiguration.standard,
    seed = SimulationSeeds()
  )

  val updateTime = 50 // todo think to put into a configuration

  @JSExportTopLevel("Platform")
  val support = new SimulationSupport(configuration) with SimulationExecutionPlatform with SimulationCommandInterpreter

  lazy val editor: EditorSection = EditorSection(SkeletonPage.editorSection)

  @JSExport
  def main(args: Array[String]): Unit = {
    val queryParams = new URLSearchParams(document.location.search)
    if (queryParams.has("headless")) {
      contentOnly()
    } else {
      spaPage()
    }
    // to improve, support for ScaFi.js
    val defaultMode = if (queryParams.has("javascript")) {
      EditorSection.JavascriptMode
    } else {
      EditorSection.ScalaModeEasy
    }
    scafiInitialization(defaultMode)
    ThemeSwitcher.Light
    ThemeSwitcher.render(SkeletonPage.navRightSide) // attach the theme switcher
  }

  def spaPage(): Unit = {
    appendOnce(document.head, SkeletonPage.renderedStyle(RootStyle.withNav()).render)
    document.body.appendChild(SkeletonPage.fullPage.render)
  }

  def contentOnly(): Unit = {
    appendOnce(document.head, SkeletonPage.renderedStyle(RootStyle.withoutNav()).render)
    document.body.appendChild(SkeletonPage.contentOnly.render)
  }

  lazy val welcomeModal: Modal = Modal.textual(
    "Welcome to ScaFi: discover the power of the collective!",
    "ScaFi-web is an online playground for creating, sharing and embedding ScaFi aggregate programs that run in your browser.",
    300
  )

  def scafiInitialization(mode: EditorSection.Mode): Unit = {
    implicit val context: Scheduler = Execution.timeoutBasedScheduler
    // dynamic part configuration
    val interaction = new Interaction.PhaserInteraction(support)
    println("Interaction created")
    val visualizationSettingsSection = VisualizationSettingsSection(
      SkeletonPage.visualizationOptionDiv,
      SensorsMenu(interaction),
      SkeletonPage.visualizationConfigDropdown
    )
    println("VisualizationSettingsSection created")
    val renders: Seq[LabelRender] = Seq(TextifyBitmap(Set("matrix")), MatrixLedRender())
    val phaserRender = new PhaserGraphSection(
      paneSection = SkeletonPage.visualizationSection,
      interaction = interaction,
      settings = visualizationSettingsSection,
      labelRenders = renders
    )
    println("PhaserGraphSection created")
    val viewControls = new InteractionBoundButtonBar(interaction)
    println("InteractionBoundButtonBar created")
    //    viewControls.render(SkeletonPage.panMoveMode)
    viewControls.render(SkeletonPage.panModeButton, SkeletonPage.selectModeButton)
    println("InteractionBoundButtonBar rendered")
    val controls = new SimulationControlsSection()
    println("SimulationControlsSection created")
    controls.render(support, editor, SkeletonPage.controlsDiv)
    println("SimulationControlsSection rendered")
    // attach the simulator with the view
    support.graphStream.sample(FiniteDuration(updateTime, TimeUnit.MILLISECONDS)).foreach(phaserRender)
    println("GraphStream attached")
    // force repaint
    support.invalidate()
    println("Support invalidated")
    SkeletonPage.visualizationSection.focus()
    println("VisualizationSection focused")
    val tour = Tour(controls).start()
    println("Tour started")
    PopoverProgression.ResetButton.render(tour, SkeletonPage.navRightSide)
    println("PopoverProgression.ResetButton rendered")
    if (!Cookie.get("visited").exists(_.toBoolean)) {
      val modal = welcomeModal
      document.body.appendChild(modal.html)
      modal.onClose = () => {
        modal.hide()
        tour.stepForward()
      }
      modal.show()
    }
    PageBus.publish(configuration) // tell to all component the new configuration installed on the frontend

    PageStructure.static()
    if (mode == EditorSection.JavascriptMode) {
      editor.setCode("", mode)
    } else {
      /*ExampleProvider
        .race(ExampleProvider.fromGlobal(), ExampleProvider.fromRemote())
        .foreach(examples => new ExampleChooser(SkeletonPage.selectionProgram, examples, configurationSection, editor))
       */
    }
  }
  @JSExportTopLevel("ScafiBackend")
  val interpreter = new local.SimulationCommandInterpreter.JsConsole(support)
}
