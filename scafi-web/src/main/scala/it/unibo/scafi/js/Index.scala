package it.unibo.scafi.js

import java.util.concurrent.TimeUnit
import it.unibo.scafi.js.controller.local
import it.unibo.scafi.js.controller.local._
import it.unibo.scafi.js.controller.scripting.Script.ScaFi
import it.unibo.scafi.js.dsl.semantics._
import it.unibo.scafi.js.dsl.{ScafiInterpreterJs, WebIncarnation}
import it.unibo.scafi.js.utils.Execution
import it.unibo.scafi.js.view.dynamic._
import it.unibo.scafi.js.view.dynamic.graph.LabelRender._
import it.unibo.scafi.js.view.dynamic.graph.{LabelRender, PhaserGraphSection, PhaserInteraction}
import it.unibo.scafi.js.view.static.{RootStyle, SkeletonPage}
import jdk.nashorn.api.scripting.URLReader
import org.scalajs.dom.experimental.URLSearchParams

import scala.concurrent.duration.FiniteDuration
import scala.scalajs.js.Object.{entries, keys}
import scala.scalajs.js.annotation.{JSExport, JSExportTopLevel, JSGlobal}
/**
  * Root object, it initialize the simulation, the page and the backend.
  */
object Index {
  import org.scalajs.dom._
  implicit val incarnation = WebIncarnation //incarnation choosed
  @JSExportTopLevel("Lang")
  implicit val languageJsInterpreter = new ScafiInterpreterJs("Lang") with BlockGJs
    with LanguageJs with BlockTJs with StandardSensorJs with BuiltinsJs// interpreter choosen
  val configuration = SupportConfiguration(
    GridLikeNetwork(10, 10, 60, 60, 0),
    SpatialRadius(range = 70),
    deviceShape = DeviceConfiguration.standard,
    seed = SimulationSeeds(),
  )
  val updateTime = 50 //todo think to put into a configuration
  @JSExportTopLevel("Platform")
  val support = new SimulationSupport(configuration)
    with SimulationExecutionPlatform
    with SimulationCommandInterpreter

  @JSExport
  def main(args: Array[String]): Unit = {
    val queryParams = new URLSearchParams(document.location.search)
    if (queryParams.has("headless")) { contentOnly() } else { spaPage() }
    scafiInitialization()
  }
  val programs = Map(
    "round counter" -> "return rep(() => 0, (k) => k+1)",
    "hello scafi" -> "return \"hello scafi\"",
    "gradient" -> """return rep(() => Infinity, (d) => {
        |  return mux(sense("source"), 0.0,
        |    foldhoodPlus(() => Infinity, Math.min, () => nbr(() => d) + nbrvar("nbrRange"))
        |  )
        | })
        |""".stripMargin,
    "channel" -> """var metric = () => nbrRange()
                   |
                   |function channel(source, target, width) {
                   |  	var threshold = distanceBetween(source, target, metric) + width
                   | 	return distanceTo(source, metric) + distanceTo(target, metric) < threshold
                   |}
                   |return channel(sense("source"), sense("obstacle"), 1)""".stripMargin
  )

  def spaPage() : Unit = {
    //page injection
    document.head.appendChild(SkeletonPage.renderedStyle(RootStyle.withNav()).render)
    document.body.appendChild(SkeletonPage.fullPage.render)
  }

  def contentOnly() : Unit = {
    //page injection
    document.head.appendChild(SkeletonPage.renderedStyle(RootStyle.withoutNav).render)
    document.body.appendChild(SkeletonPage.contentOnly.render)
  }

  def scafiInitialization() : Unit = {
    implicit val context = Execution.timeoutBasedScheduler
    //dynamic part configuration
    val visualizationSettingsSection = VisualizationSettingsSection(SkeletonPage.visualizationOptionDiv)
    val renders : Seq[LabelRender] = Seq(BooleanRender(), BooleanExport(), /*LabelRender.gradientLike, test only*/ TextifyBitmap())
    val phaserRender = new PhaserGraphSection(SkeletonPage.visualizationSection, new PhaserInteraction(support), visualizationSettingsSection, renders)
    val configurationSection = new ConfigurationSection(SkeletonPage.backendConfig, support)
    val editor = new EditorSection(SkeletonPage.editorSection, SkeletonPage.selectionProgram, programs)
    SimulationControlsSection.render(support, editor.editor, SkeletonPage.controlsDiv)
    //attach the simulator with the view
    support.graphStream.sample(FiniteDuration(updateTime, TimeUnit.MILLISECONDS)).foreach(phaserRender)
    //force repaint
    support.invalidate()
    SkeletonPage.visualizationSection.focus()
    EventBus.publish(configuration) //tell to all component the new configuration installed on the frontend
  }
  @JSExportTopLevel("ScafiBackend")
  val interpreter = new local.SimulationCommandInterpreter.JsConsole(support)
}