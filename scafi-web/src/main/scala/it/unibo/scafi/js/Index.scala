package it.unibo.scafi.js

import java.util.concurrent.TimeUnit

import it.unibo.scafi.js.controller.local
import it.unibo.scafi.js.controller.local._
import it.unibo.scafi.js.utils.Execution
import it.unibo.scafi.js.view.dynamic._
import it.unibo.scafi.js.view.dynamic.graph.{LabelRender, PhaserGraphSection, PhaserInteraction}
import it.unibo.scafi.js.view.static.SkeletonPage

import scala.concurrent.duration.FiniteDuration
import scala.scalajs.js.annotation.{JSExport, JSExportTopLevel}
/**
  * Root object, it initialize the simulation, the page and the backend.
  */
object Index {
  import org.scalajs.dom._
  val configuration = SupportConfiguration(
    GridLikeNetwork(10, 10, 60, 60, 0),
    SpatialRadius(range = 60),
    deviceShape = DeviceConfiguration.standard,
    seed = SimulationSeeds(),
  )
  val updateTime = 100 //todo think to put into a configuration
  val support = new SimulationSupport(configuration)
    with SimulationExecutionPlatform
    with SimulationCommandInterpreter

  @JSExport
  def main(args: Array[String]): Unit = configurePage()

  val programs = Map(
    "round counter" -> "rep(() => 0, (k) => k+1)",
    "hello scafi" -> "\"hello scafi\"",
    "gradient" -> """rep(() => Infinity, (d) => {
        |  return mux(sense("source"), 0.0,
        |    foldhoodPlus(() => Infinity, Math.min, () => nbr(() => d) + nbrvar("nbrRange"))
        |  )
        | })
        |""".stripMargin
  )

  def configurePage(): Unit = {
    implicit val context = Execution.timeoutBasedScheduler
    //page injection
    document.head.appendChild(SkeletonPage.renderedStyle.render)
    document.body.appendChild(SkeletonPage.content.render)
    //dynamic part configuration
    val visualizationSettingsSection = VisualizationSettingsSection(SkeletonPage.visualizationOptionDiv)
    val renders : Seq[LabelRender.LabelRender] = Seq(LabelRender.booleanRender, LabelRender.textify)
    val phaserRender = new PhaserGraphSection(SkeletonPage.visualizationSection, new PhaserInteraction(support), visualizationSettingsSection, renders)
    val configurationSection = new ConfigurationSection(SkeletonPage.backendConfig, support)
    val editor = new EditorSection(SkeletonPage.editorSection, SkeletonPage.selectionProgram, programs)
    SimulationControlsSection.render(support, editor.editor, SkeletonPage.controlsDiv)
    //attach the simulator with the view
    support.graphStream.sample(FiniteDuration(updateTime, TimeUnit.MILLISECONDS)).foreach(phaserRender)
    //force repaint
    support.invalidate()
    EventBus.publish(configuration) //tell to all component the new configuration installed on the frontend
  }

  @JSExportTopLevel("ScafiBackend")
  val interpreter = new local.SimulationCommandInterpreter.JsConsole(support)
}