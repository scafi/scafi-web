package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.code.Example
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.controller.scripting.Script.{Javascript, Scala, ScalaEasy}
import it.unibo.scafi.js.facade.codemirror.{CodeMirror, Doc, EditorConfiguration}
import it.unibo.scafi.js.utils.GlobalStore
import it.unibo.scafi.js.view.dynamic.EditorSection.Mode
import org.querki.jquery.$
import org.scalajs.dom.html.Div

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobalScope
import scala.util.{Failure, Success}

trait EditorSection {
  def setCode(code: String, mode: Mode): Unit

  def getScript(): Script

  def getRaw(): String

  def mode: Mode
}

object EditorSection {
  val modeKey = new GlobalStore.Key {
    type Data = Mode
    override val value: String = "mode"
  }
  val docKey = new GlobalStore.Key {
    override type Data = Doc
    override val value: String = "doc"
  }
  trait Mode extends js.Object {
    def lang: String

    def codeMirrorMode: String
  }

  object ScalaModeFull extends Mode {
    override val lang: String = "full-scala"
    override val codeMirrorMode: String = "text/x-scala"
  }

  object ScalaModeEasy extends Mode {
    private val pattern = """(?:\s*//\s*using\s*)(\w*(?:\s*,\s*\w+)*)""".r.unanchored
    override val lang: String = "easy-scala"
    override val codeMirrorMode: String = "text/x-scala"

    def convertToFull(code: String): String = {
      val (libsCode, line) = code match {
        case pattern(libs) if libs.nonEmpty =>
          val libsCode = s"with ${libs.replaceAll("""\s*,\s*""", " with ")}"
          val line = pattern.findAllIn(code).group(0)
          (libsCode, line)
        case _ => ("", "")
      }
      val body = code.replaceAll(line, "")
      val bodyShifted = body
        .split("\n")
        .filter(_.nonEmpty)
        .map(line => "\t\t" + line)
        .filter(_.nonEmpty)
        .mkString("\n")
      s"""class MyProgram extends AggregateProgram $libsCode {
        |  override def main() : Any = {
        |  $bodyShifted
        |  }
        |}
        |val program = new MyProgram
        |""".stripMargin
    }
  }

  object JavascriptMode extends Mode {
    override val lang: String = "javascript"
    override val codeMirrorMode: String = lang
  }

  def modeFromLang(lang: String): Mode = lang match {
    case ScalaModeFull.lang => ScalaModeFull
    case ScalaModeEasy.lang => ScalaModeEasy
    case JavascriptMode.lang => JavascriptMode
  }

  private class EditorSectionImpl(editorZone: Div, defaultMode: Mode = ScalaModeEasy) extends EditorSection {
    var mode: Mode = GlobalStore.get(EditorSection.modeKey) match {
      case Failure(exception) => defaultMode
      case Success(mode) => mode
    }
    private val modeSelection = new ModeSelection(
      "editor-header",
      mode.lang match {
        case ScalaModeEasy.lang => false
        case ScalaModeFull.lang => true
      }
    )
    private lazy val popup: Modal = Modal.okCancel(
      "Warning!",
      "The mode change will erase all your code, are you sure?",
      onOk = () => {
        this.setCode("", ScalaModeEasy)
        popup.hide()
        modeSelection.off()
      },
      onCancel = () => {
        popup.hide()
        modeSelection.on()
      }
    )
    val editor = GlobalStore.get(docKey) match {
      case Success(doc) =>
        val config = new EditorConfiguration(doc.getValue(), mode.codeMirrorMode, "native", true, "material")
        val editor = CodeMirror(editorZone, config)
        editor.doc.setHistory(doc.getHistory())
        editor
      case Failure(exception) =>
        val config = new EditorConfiguration("", mode.codeMirrorMode, "native", true, "material")
        CodeMirror(editorZone, config)
    }
    ThemeSwitcher.onDark(editor.setOption("theme", "material"))
    ThemeSwitcher.onLight(editor.setOption("theme", "default"))

    GlobalStore.put(docKey)(editor.doc)
    modeSelection.onClick = () => {
      if (mode.lang == ScalaModeEasy.lang) {
        val fullCode = ScalaModeEasy.convertToFull(this.getRaw())
        this.setCode(fullCode, ScalaModeFull)
      } else {
        popup.show()
      }
    }
    PageBus.listen { case Example(_, code, _) => this.setCode(code, ScalaModeEasy) }

    override def setCode(code: String, mode: Mode): Unit = {
      mode.lang match {
        case ScalaModeEasy.lang => modeSelection.off()
        case ScalaModeFull.lang => modeSelection.on()
        case _ =>
      }
      editor.setValue(code)
      GlobalStore.put(modeKey)(mode)
      this.mode = mode
      editor.setOption("mode", mode.codeMirrorMode)
    }

    override def getScript(): Script = mode.lang match {
      case JavascriptMode.lang => Javascript(getRaw())
      case ScalaModeFull.lang => Scala(getRaw())
      case ScalaModeEasy.lang => ScalaEasy(getRaw())
    }

    override def getRaw(): String = editor.getValue()
  }

  def apply(div: Div): EditorSection = {
    div.id = "blockly-editor"
    new EditorSection {
      override def setCode(code: String, mode: Mode): Unit = {}

      override def getScript(): Script = Script.ScalaEasy(getRaw())

      override def getRaw(): String = js.Dynamic.global.ScafiBlocks.asInstanceOf[String]

      override def mode: Mode = ScalaModeEasy
    }
  }

  class ModeSelection(id: String, enabled: Boolean) {
    private val mode = $(s"#$id")
    private val toggle = Toggle("advanced", enabled, e => onClick())
    toggle.html.classList.add("ml-2")
    mode.append(toggle.html)
    def isChecked(): Boolean = toggle.enabled
    var onClick: () => Unit = () => {}
    def off(): Unit = toggle.uncheck()
    def on(): Unit = toggle.check()
  }
}
