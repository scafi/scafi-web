package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.controller.scripting.Script.{Javascript, Scala}
import it.unibo.scafi.js.facade.codemirror.{CodeMirror, Editor, EditorConfiguration}
import it.unibo.scafi.js.facade.simplebar.SimpleBarConfig.ForceX
import it.unibo.scafi.js.facade.simplebar.{SimpleBar, SimpleBarConfig}
import it.unibo.scafi.js.view.dynamic.EditorSection.Mode
import org.scalajs.dom.html
import org.scalajs.dom.html.TextArea

trait EditorSection {
  def setCode(code : String, mode : Mode)
  def getScript() : Script
  def getRaw() : String
  def mode : Mode
}

object EditorSection {
  trait Mode {
    def lang : String
    def codeMirrorMode : String
  }
  case object ScalaMode extends Mode {
    override val lang: String = "scala"
    override val codeMirrorMode: String = "text/x-scala"
  }
  case object JavascriptMode extends Mode {
    override val lang: String = "javascript"
    override val codeMirrorMode: String = lang
  }
  def modeFromLang(lang : String) : Mode = lang match {
    case ScalaMode.lang => ScalaMode
    case JavascriptMode.lang => JavascriptMode
  }

  private class EditorSectionImpl(textArea : TextArea, examples: html.Select, modeSelector : html.Select, codeExample : Map[String, String])
    extends EditorSection {
    import scalatags.JsDom.all._
    var mode: Mode = JavascriptMode
    private lazy val editor : Editor = CodeMirror.fromTextArea(textArea, new EditorConfiguration(mode.codeMirrorMode, "native", true))
    new SimpleBar(textArea, new SimpleBarConfig(forceVisible = ForceX)).recalculate()
    private val optionInSelect = codeExample.keys.map(key => option(value := key, key).render).toList

    optionInSelect.headOption.foreach( option => {
      option.selected = true
      editor.setValue(codeExample(option.value))
    })

    private val modes = Seq(JavascriptMode, ScalaMode).map(_.lang).map(data => option(value := data, data).render)
    modes.head.selected = true
    modes.foreach(modeSelector.add(_))

    examples.onchange = _ => {
      val option = optionInSelect(examples.selectedIndex)
      editor.setValue(codeExample(option.value))
    }

    modeSelector.onchange = _ => {
      val selectedMode = modes(modeSelector.selectedIndex)
      mode = modeFromLang(selectedMode.value)
      editor.setOption("mode", mode.codeMirrorMode)
    }
    optionInSelect.foreach(option => examples.appendChild(option))

    override def setCode(code: String, mode: Mode): Unit = {
      editor.setValue(code)
      this.mode = mode
      editor.setOption("mode", mode.codeMirrorMode)
      modes.filter(_.value == mode.lang).foreach(_.selected = true)
    }

    override def getScript(): Script = mode match {
      case JavascriptMode => Javascript(getRaw())
      case ScalaMode => Scala(getRaw())
    }

    override def getRaw(): String = editor.getValue()

  }

  def apply(textArea : TextArea, examples: html.Select, modeSelector : html.Select, codeExample : Map[String, String]) : EditorSection = {
    new EditorSectionImpl(textArea, examples, modeSelector, codeExample)
  }
}
