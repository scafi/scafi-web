package it.unibo.scafi.js

import it.unibo.scafi.js.controller.local
import it.unibo.scafi.js.controller.local._
import it.unibo.scafi.js.dsl.{BasicWebIncarnation, ScafiInterpreterJs, WebIncarnation}
import it.unibo.scafi.js.dsl.semantics._
import it.unibo.scafi.js.utils.{Cookie, Execution}
import it.unibo.scafi.js.view.dynamic._
import it.unibo.scafi.js.view.dynamic.graph.{PhaserGraphSection, PhaserInteraction}
import it.unibo.scafi.js.view.dynamic.graph.LabelRender._
import it.unibo.scafi.js.view.static.{RootStyle, SkeletonPage}
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
  new ScafiInterpreterJs("Lang")
    with BlockGJs
    with LanguageJs
    with BlockTJs
    with StandardSensorJs
    with BuiltinsJs

  val configuration: SupportConfiguration = SupportConfiguration(
    GridLikeNetwork(10, 10, 60, 60, 0),
    SpatialRadius(range = 70),
    deviceShape = DeviceConfiguration.standard,
    seed = SimulationSeeds(),
  )

  val updateTime = 50 // todo think to put into a configuration

  @JSExportTopLevel("Platform")
  val support = new SimulationSupport(configuration)
    with SimulationExecutionPlatform
    with SimulationCommandInterpreter

  lazy val editor: EditorSection =
    EditorSection(SkeletonPage.editorSection, SkeletonPage.selectionProgram, programs)

  @JSExport
  def main(args: Array[String]): Unit = {
    val queryParams = new URLSearchParams(document.location.search)
    if (queryParams.has("headless")) {
      contentOnly()
    } else {
      spaPage()
    }
    scafiInitialization()
  }

  lazy val programs = Map(
    "round counter" -> "rep(0)(_ + 1)",
    "hello scafi" -> "\"hello scafi\"",
    "gradient" ->
      """// using StandardSensors
        |rep(Double.PositiveInfinity) {
        |  d => {
        |    mux(sense[Boolean]("source")) { 0.0 } {
        |    	foldhoodPlus(d)(Math.min)(nbr(d) + nbrRange())
        |    }
        |  }
        |}
        |""".stripMargin,
    "channel" ->
      """//using BlockG, StandardSensors
        |def channel(source : Boolean, target : Boolean, width : Double) : Boolean = {
        |  val threshold : Double = distanceBetween(source, target, nbrRange) + width
        |  distanceTo(source, nbrRange) + distanceTo(target, nbrRange) < threshold
        |}
        |return channel(sense("source"), sense("obstacle"), 1)""".stripMargin
  )

  def spaPage(): Unit = {
    document.head.appendChild(SkeletonPage.renderedStyle(RootStyle.withNav()).render)
    document.body.appendChild(SkeletonPage.fullPage.render)
  }

  def contentOnly(): Unit = {
    // page injection
    document.head.appendChild(SkeletonPage.renderedStyle(RootStyle.withoutNav).render)
    document.body.appendChild(SkeletonPage.contentOnly.render)
  }

  lazy val welcomeModal: Modal = Modal.textual(
    "Welcome to ScaFi: discover the power of the collective!",
    "ScaFi-web is an online playground for creating, sharing and embedding ScaFi aggregate programs that run in your browser.",
    300)

  def buildTour(controls: SimulationControlsSection): PopoverProgression.Builder = SkeletonPage
    .popoverTourBuilder
    .addNextPopover(
      attachTo = controls.loadButton.id,
      title = "Load code",
      text = "Every time you edit your code and want to load it onto the network, click here ...",
      direction = Popover.Bottom)
    .addNextPopover(
      attachTo = controls.startButton.id,
      title = "Start the simulation",
      text = "... and then start the simulation here"
    )
    .addNextPopover(
      attachTo = controls.stopButton.id,
      title = "Stop the simulation",
      text = "You can stop the simulation with this butto to restart it later."
    )
    .addNextPopover(
      attachTo = controls.tick.id,
      title = "Tick-by-tick progression",
      text = "You can also progress in the simulation tick-by-tick using this button."
    )
    // TODO add batch description
    // TODO add period description
    .andFinally(() => Cookie.store("visited", "true"))

  def scafiInitialization(): Unit = {

    implicit val context: Scheduler = Execution.timeoutBasedScheduler
    // dynamic part configuration
    val visualizationSettingsSection = VisualizationSettingsSection(SkeletonPage.visualizationOptionDiv)
    val renders: Seq[LabelRender] = Seq(BooleanRender(), BooleanExport(), /*LabelRender.gradientLike, test only*/ TextifyBitmap())
    val phaserRender = new PhaserGraphSection(SkeletonPage.visualizationSection, new PhaserInteraction(support), visualizationSettingsSection, renders)
    val configurationSection = new ConfigurationSection(SkeletonPage.backendConfig, support)
    val controls = new SimulationControlsSection()
    controls.render(support, editor, SkeletonPage.controlsDiv)
    // attach the simulator with the view
    support.graphStream.sample(FiniteDuration(updateTime, TimeUnit.MILLISECONDS)).foreach(phaserRender)
    // force repaint
    support.invalidate()
    SkeletonPage.visualizationSection.focus()
    EventBus.publish(configuration) // tell to all component the new configuration installed on the frontend

    if (!Cookie.get("visited").exists(_.toBoolean)) {
      val modal = welcomeModal
      document.body.appendChild(modal.html)
      val tour = buildTour(controls).start()
      modal.onClose = _ => {
        modal.hide()
        tour.stepForward()
      }
      modal.show()
    }
  }

  @JSExportTopLevel("ScafiBackend")
  val interpreter = new local.SimulationCommandInterpreter.JsConsole(support)
}
