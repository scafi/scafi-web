package it.unibo.scafi.js.view.static

import it.unibo.scafi.js.utils.Debug
import org.querki.jquery.$
import org.scalajs.dom.Element
import org.scalajs.dom.html.Div
import scalatags.JsDom.all.div

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
    val firstSection = 1
    val configPortion = 10
    val editorPortion = 40
    val visualizationPortion = 49
    val minControlPortion = 300
    val minEditorPortion = 300
    val minVisualizationPortion = 800 //put in css?? verify..
    val configSection = SplitSection(configPortion, minControlPortion, "#backend-config-section")
    val editorSection = SplitSection(editorPortion, minEditorPortion, "#editor-section")
    val visualizationSection = SplitSection(visualizationPortion, minVisualizationPortion, "#visualization-section")
    var split : js.Dynamic = Split.default
    var gutterCreator : js.Any = Split.default
    val doubleClickEvent = (ev : js.Any) => {
      val backendSection = $("#backend-config-section")
      split.destroy()
      if(backendSection.is(":visible")) {
        split = createSplit(gutterCreator,
          configSection.copy(minSize = 0, size = 0),
          editorSection,
          visualizationSection.copy(size = configSection.size + visualizationSection.size))
        backendSection.hide()
      } else {
        backendSection.show()
        split = createSplit(gutterCreator, configSection, editorSection, visualizationSection)
      }
    }
    gutterCreator = (index : Int, direction : Any, pairElement : Element) => {
      val gutter : Div = div().render
      gutter.className = s"gutter gutter-${direction}"
      if(index == firstSection) {
        gutter.ondblclick = doubleClickEvent
      }
      gutter
    }
    split = createSplit(gutterCreator, configSection, editorSection, visualizationSection)
    Debug("split", split)
    $("#backend-config-section").addClass("pl-3")
  }

  case class SplitSection(size : Int, minSize : Int, id : String)

  private def createSplit(handler : js.Any, splitSection: SplitSection *) : js.Dynamic = {
    val sections = js.Array(splitSection.map(_.id):_*)
    val sizes = js.Array(splitSection.map(_.size):_*)
    val minSizes = js.Array(splitSection.map(_.minSize):_*)
    Split.default(sections,
      js.Dynamic.literal(
        "sizes" -> sizes,
        "minSize" -> minSizes,
        "gutter" -> handler
      )
    )
  }
}
