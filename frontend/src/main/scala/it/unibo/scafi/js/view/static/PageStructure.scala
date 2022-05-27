package it.unibo.scafi.js.view.static

import it.unibo.scafi.js.utils.{Debug, GlobalStore}
import org.querki.jquery.$
import org.scalajs.dom.html.{Div, Element}
import scalatags.JsDom.all.div

import scala.scalajs.js
import scala.util.Success

trait PageStructure

object PageStructure {
  def static(): Unit = {
    $("#backend-config-section").addClass("col-2")
    $("#editor-section").addClass("col-4")
    $("#visualization-section").addClass("col-6")
  }

  def resizable(): Unit = Resizable.install()

  object Resizable {
    private val firstSection = 1
    private val (configPortion, editorPortion, visualizationPortion) = (15.0, 35.0, 49.0)
    private val (minControlPortion, minEditorPortion, minVisualizationPortion) = (240, 250, 420)
    private val empty = new SplitSection(0, 0)
    private val (config, editor, visualization) = (0, 1, 2)
    // val sizes = GlobalStore.getOrElseUpdate[PageSizes](sizesInGlobal, new PageSizes(configPortion, editorPortion, visualizationPortion))
    private val sections = js.Array("#backend-config-section", "#editor-section", "#visualization-section")
    private val configSection = new SplitSection(configPortion, minControlPortion)
    private val editorSection = new SplitSection(editorPortion, minEditorPortion)
    private val visualizationSection = new SplitSection(visualizationPortion, minVisualizationPortion)
    private val standardConfig = new PageDivision(false, js.Array(configSection, editorSection, visualizationSection))
    private var split: js.Dynamic = Split.default
    private val gutterCreator: js.Any = (index: Int, direction: Any, pairElement: Element) => {
      val gutter: Div = div().render
      gutter.className = s"gutter gutter-$direction"
      if (index == firstSection) {
        gutter.ondblclick = doubleClickEvent
      }
      gutter
    }

    private val doubleClickEvent = (ev: js.Any) => {
      val backendSection = $("#backend-config-section")
      split.destroy()
      val divisions = GlobalStore.get[PageDivision](sizesInGlobal).get
      if (divisions.collapsed) {
        divisions.elems(config) = configSection
        divisions.elems(visualization) =
          new SplitSection(divisions.elems(visualization).size - configSection.size, minVisualizationPortion)
        backendSection.show()
        GlobalStore.put(sizesInGlobal, new PageDivision(false, divisions.elems))
        split = createSplit(gutterCreator, sections, divisions.elems: _*)
      } else {
        backendSection.hide()
        val oldConfig = divisions.elems(config)
        divisions.elems(config) = empty
        divisions.elems(visualization) =
          new SplitSection(divisions.elems(visualization).size + oldConfig.size, minVisualizationPortion)
        GlobalStore.put(sizesInGlobal, new PageDivision(true, divisions.elems))
        split = createSplit(gutterCreator, sections, divisions.elems: _*)
      }
    }

    def install(): Unit = {
      val divisions: PageDivision = GlobalStore.getOrElseUpdate(sizesInGlobal, standardConfig)
      val backendSection = $("#backend-config-section")
      if (divisions.collapsed) {
        backendSection.hide()
        val oldConfig = divisions.elems(config)
        divisions.elems(config) = empty
        divisions.elems(visualization) =
          new SplitSection(divisions.elems(visualization).size + oldConfig.size, minVisualizationPortion)
      }
      split = createSplit(gutterCreator, sections, divisions.elems: _*)
      $("#backend-config-section").addClass("pl-3")
    }

    private def createSplit(handler: js.Any, sections: js.Array[String], splitSection: SplitSection*): js.Dynamic = {
      val sizes = js.Array(splitSection.map(_.size): _*)
      val minSizes = js.Array(splitSection.map(_.minSize): _*)
      Split.default(
        sections,
        js.Dynamic.literal(
          "sizes" -> sizes,
          "minSize" -> minSizes,
          "gutter" -> handler,
          "expandToMin" -> true,
          "onDrag" -> ((elems: js.Array[Double]) => {
            split.destroy()
            val oldConfig = GlobalStore.get[PageDivision](sizesInGlobal).get
            val newPageDivision = new PageDivision(
              oldConfig.collapsed,
              js.Array(
                new SplitSection(
                  if (oldConfig.collapsed) 0 else elems(config),
                  if (oldConfig.collapsed) 0 else minControlPortion
                ),
                new SplitSection(elems(editor), minEditorPortion),
                new SplitSection(
                  elems(visualization) + (if (oldConfig.collapsed) elems(config) else 0),
                  minVisualizationPortion
                )
              )
            )
            install()
            GlobalStore.put(sizesInGlobal, newPageDivision)
          })
        )
      )
    }
  }

  class SplitSection(val size: Double, val minSize: Int) extends js.Object
  class PageDivision(val collapsed: Boolean, val elems: js.Array[SplitSection]) extends js.Object
  val sizesInGlobal = "page-sizes"
}
