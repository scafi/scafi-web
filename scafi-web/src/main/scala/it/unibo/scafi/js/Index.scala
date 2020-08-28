package it.unibo.scafi.js

import java.util.concurrent.TimeUnit

import it.unibo.scafi.js.controller.local._
import it.unibo.scafi.js.view.dynamic.{EditorSection, PhaserGraphSection, SimulationControlsSection}
import it.unibo.scafi.js.view.static.SkeletonPage

import scala.concurrent.duration.FiniteDuration
import scala.scalajs.js.annotation.{JSExport, JSExportTopLevel}
/**
  * from the main body, scala js produce a javascript file.
  * it is an example of a ScaFi simulation transcompilated in javascript.
  */
@JSExportTopLevel("Index")
object Index {
  import org.scalajs.dom._

  val configuration = SupportConfiguration(
    RandomNetwork(min = 0, max = 800, howMany = 500),
    SpatialRadius(range = 30),
    deviceShape = DeviceConfiguration.standard,
    seed = SimulationSeeds(),
  )

  val updateTime = 100 //todo think to put into a configuration
  val support = new SimulationSupport(configuration) with SimulationExecutionPlatform
  @JSExport
  def main(args: Array[String]): Unit = {
    println("Index.main !!!")
    configurePage()
  }
  val programs = Map(
    "round counter" -> "rep(() => 0, (k) => k+1)",
    "hello scafi" -> "\"hello scafi\"",
    "gradient" ->
      """rep(() => Infinity, (d) => {
        |  return mux(sense("source"), 0.0,
        |    foldhoodPlus(() => Infinity, Math.min, () => nbr(() => d) + nbrvar("nbrRange"))
        |  )
        | })
        |""".stripMargin
  )

  def configurePage(): Unit = {
    document.head.appendChild(SkeletonPage.renderedStyle.render)
    document.body.appendChild(SkeletonPage.content.render)
    val editor = new EditorSection(SkeletonPage.editorSection, SkeletonPage.selectionProgram, programs)
    implicit val context = Utils.timeoutBasedScheduler
    SimulationControlsSection.render(support, editor.editor, SkeletonPage.controlsDiv)
    val phaserRender = new PhaserGraphSection(SkeletonPage.visualizationSection)
    support.graphStream.sample(FiniteDuration(updateTime, TimeUnit.MILLISECONDS)).foreach(phaserRender)
  }
}
