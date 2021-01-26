package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.code.Example
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.controller.scripting.Script.{Javascript, Scala, ScalaEasy}
import it.unibo.scafi.js.facade.codemirror.{CodeMirror, Doc, EditorConfiguration}
import it.unibo.scafi.js.utils.GlobalStore
import it.unibo.scafi.js.view.dynamic.EditorSection.Mode
import org.querki.jquery.$
import org.scalajs.dom.html.Div

import scala.util.{Failure, Success}

trait EditorSection {
  def setCode(code: String, mode: Mode): Unit

  def getScript(): Script

  def getRaw(): String

  def mode: Mode
}

object EditorSection {

  trait Mode {
    def lang: String

    def codeMirrorMode: String
  }

  case object ScalaModeFull extends Mode {
    override val lang: String = "full-scala"
    override val codeMirrorMode: String = "text/x-scala"
  }

  case object ScalaModeEasy extends Mode {
    private val pattern = """(?:\s*//\s*using\s*)(\w*(?:\s*,\s*\w+)*)""".r.unanchored
    override val lang: String = "easy-scala"
    override val codeMirrorMode: String = "text/x-scala"

    def convertToFull(code: String): String = {
      val (libsCode, line) = code match {
        case pattern(libs) if (libs.nonEmpty) =>
          val libsCode = s"with ${libs.replaceAll("""\s*,\s*""", " with ")}"
          val line = pattern.findAllIn(code).group(0)
          (libsCode, line)
        case _ => ("", "")
      }
      val body = code.replaceAll(line, "")
      val bodyShifted = body.split("\n")
        .filter(_.nonEmpty)
        .map(line => "\t\t" + line)
        .filter(_.nonEmpty).mkString("\n")
      s"""class MyProgram extends AggregateProgram ${libsCode} {
         |  override def main() : Any = {
         |  ${bodyShifted}
         |  }
         |}
         |val program = new MyProgram
         |""".stripMargin
    }
  }

  case object JavascriptMode extends Mode {
    override val lang: String = "javascript"
    override val codeMirrorMode: String = lang
  }

  def modeFromLang(lang: String): Mode = lang match {
    case ScalaModeFull.lang => ScalaModeFull
    case ScalaModeEasy.lang => ScalaModeEasy
    case JavascriptMode.lang => JavascriptMode
  }

  private class EditorSectionImpl(editorZone: Div)
    extends EditorSection {
    var mode: Mode = ScalaModeEasy
    private val modeSelection = new ModeSelection("editor-header")
    private lazy val popup: Modal = Modal.okCancel("Warning!", "The mode change will erase all your code, are you sure?",
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
    val editor = GlobalStore.get[Doc]("doc") match {
      case Success(doc) => val config = new EditorConfiguration(doc.getValue(), mode.codeMirrorMode, "native", true, "material")

        val editor = CodeMirror(editorZone, config)
        editor.doc.setHistory(doc.getHistory())
        editor
      case Failure(exception) => val config = new EditorConfiguration("", mode.codeMirrorMode, "native", true, "material")
         CodeMirror(editorZone, config)
    }
    GlobalStore.put("doc", editor.doc)
    modeSelection.onClick = () => {
      if (mode == ScalaModeEasy) {
        val fullCode = ScalaModeEasy.convertToFull(this.getRaw())
        editor.setValue(fullCode)
        this.mode = ScalaModeFull
      } else {
        popup.show()
      }
    }
    PageBus.listen { case Example(_, code, _) => this.setCode(code, ScalaModeEasy) }

    override def setCode(code: String, mode: Mode): Unit = {
      mode match {
        case ScalaModeEasy => modeSelection.off()
        case ScalaModeFull => modeSelection.on()
        case _ =>
      }
      editor.setValue(code)
      this.mode = mode
      editor.setOption("mode", mode.codeMirrorMode)
    }

    override def getScript(): Script = mode match {
      case JavascriptMode => Javascript(getRaw())
      case ScalaModeFull => Scala(getRaw())
      case ScalaModeEasy => ScalaEasy(getRaw())
    }

    override def getRaw(): String = editor.getValue()
  }

  def apply(div: Div): EditorSection = {
    new EditorSectionImpl(div)
  }

  class ModeSelection(id: String) {
    private val mode = $(s"#$id")
    private val toggle = Toggle("advanced", false, e => onClick())
    toggle.html.classList.add("ml-2")
    mode.append(toggle.html)
    def isChecked(): Boolean = toggle.enabled
    var onClick : () => Unit = () => {}
    def off(): Unit = toggle.uncheck()
    def on(): Unit = toggle.check()
  }

}
