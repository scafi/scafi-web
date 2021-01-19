package it.unibo.scafi.js.view.static

import it.unibo.scafi.js.utils.{Debug, GlobalStore}
import org.querki.jquery.$
import org.scalajs.dom.{document, window}

import scala.scalajs.js

trait PageStructure {

}

object PageStructure {
  def static(): Unit = {
    $("#backend-config-section").addClass("col-2")
    $("#editor-section").addClass("col-4")
    $("#visualization-section").addClass("col-6")
  }

  def resizable() : Unit = {
    val configPortion = 10
    val editorPortion = 40
    val visualizationPortion = 49
    val minControlPortion = 300
    val minEditorPortion = 300
    val minVisualizationPortion = 800
    val sizes = "sizes" -> js.Array(configPortion, editorPortion, visualizationPortion)
    val minSizes = "minSize" -> js.Array(minControlPortion, minEditorPortion, minVisualizationPortion)
    Split.default(js.Array("#backend-config-section","#editor-section", "#visualization-section"),
      js.Dynamic.literal(sizes, minSizes)
    )
    $("#backend-config-section").addClass("pl-3")
  }
}
