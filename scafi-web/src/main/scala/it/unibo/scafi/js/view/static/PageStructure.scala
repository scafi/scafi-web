package it.unibo.scafi.js.view.static

import it.unibo.scafi.js.utils.{Debug, GlobalStore}
import org.querki.jquery.$
import org.scalajs.dom.Element
import org.scalajs.dom.html.Div
import scalatags.JsDom.all.div

import scala.scalajs.js
import scala.util.Success

object PageStructure {
  def static(): Unit = {
    $("#backend-config-section").addClass("col-2")
    $("#editor-section").addClass("col-4")
    $("#visualization-section").addClass("col-6")
  }

  def resizable() : Unit = Resizable.install()

  object Resizable {
    private val firstSection = 1
    private val configPortion = 10
    private val editorPortion = 40
    private val visualizationPortion = 49
    private val minControlPortion = 300
    private val minEditorPortion = 300
    private val minVisualizationPortion = 400 //put in css?? verify..
    private val configSection = SplitSection(configPortion, minControlPortion, "#backend-config-section")
    private val editorSection = SplitSection(editorPortion, minEditorPortion, "#editor-section")
    private val visualizationSection = SplitSection(visualizationPortion, minVisualizationPortion, "#visualization-section")
    private var split : js.Dynamic = Split.default
    private val gutterCreator : js.Any = (index : Int, direction : Any, pairElement : Element) => {
      val gutter : Div = div().render
      gutter.className = s"gutter gutter-${direction}"
      if(index == firstSection) {
        gutter.ondblclick = doubleClickEvent
      }
      gutter
    }

    private val doubleClickEvent = (ev : js.Any) => {
      val backendSection = $("#backend-config-section")
      split.destroy()
      if(backendSection.is(":visible")) {
        GlobalStore.put("mode", "noconfig")

      } else {
        GlobalStore.put("mode", "full")
        backendSection.show()
      }
      split = createSplitFromGlobal()
    }

    def install() : Unit = {
      split = createSplitFromGlobal()
      Debug("split", split)
      $("#backend-config-section").addClass("pl-3")
    }
    case class SplitSection(size : Int, minSize : Int, id : String)

    private def createSplitFromGlobal() : js.Dynamic = {
      GlobalStore.get[String]("mode") match {
        case Success("full") => createSplit(gutterCreator, configSection, editorSection, visualizationSection)
        case Success("noconfig") =>
          $("#backend-config-section").hide()
          createSplit(gutterCreator,
            configSection.copy(minSize = 0, size = 0),
            editorSection,
            visualizationSection.copy(size = configSection.size + visualizationSection.size))

        case _ => createSplit(gutterCreator, configSection, editorSection, visualizationSection)
      }
    }

    private def createSplit(handler : js.Any, splitSection: SplitSection *) : js.Dynamic = {
      val sections = js.Array(splitSection.map(_.id):_*)
      val sizes = js.Array(splitSection.map(_.size):_*)
      val minSizes = js.Array(splitSection.map(_.minSize):_*)
      Split.default(sections,
        js.Dynamic.literal(
          "sizes" -> sizes,
          "minSize" -> minSizes,
          "gutter" -> handler,
          "expandToMin" -> true
        )
      )
    }
  }
}
