package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.code.Example
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.controller.scripting.Script.{Javascript, Scala, ScalaEasy}
import it.unibo.scafi.js.facade.codemirror.{CodeMirror, Doc, Editor, EditorConfiguration}
import it.unibo.scafi.js.facade.simplebar.SimpleBarConfig.ForceX
import it.unibo.scafi.js.facade.simplebar.{SimpleBar, SimpleBarConfig}
import it.unibo.scafi.js.utils.{Debug, GlobalStore}
import it.unibo.scafi.js.view.dynamic.EditorSection.Mode
import org.querki.jquery.{$, JQuery, JQueryEventObject}
import org.scalajs.dom.html
import org.scalajs.dom.html.TextArea

import javax.xml.bind.JAXBElement.GlobalScope
import scala.util.{Failure, Success}

trait EditorSection {
  def setCode(code : String, mode : Mode) : Unit
  def getScript() : Script
  def getRaw() : String
  def mode : Mode
}

object EditorSection {
  trait Mode {
    def lang : String
    def codeMirrorMode : String
  }
  case object ScalaModeFull extends Mode {
    override val lang: String = "full-scala"
    override val codeMirrorMode: String = "text/x-scala"
  }
  case object ScalaModeEasy extends Mode {
    private val pattern = """(?:\s*//\s*using\s*)(\w*(?:\s*,\s*\w+)*)""".r.unanchored
    override val lang: String = "easy-scala"
    override val codeMirrorMode: String = "text/x-scala"
    def convertToFull(code : String) : String = {
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
  def modeFromLang(lang : String) : Mode = lang match {
    case ScalaModeFull.lang => ScalaModeFull
    case ScalaModeEasy.lang => ScalaModeEasy
    case JavascriptMode.lang => JavascriptMode
  }

  private class EditorSectionImpl(textArea : TextArea)
    extends EditorSection {
    var mode: Mode = ScalaModeEasy
    private val modeSelection = new ModeSelection("modeSelection")
    private lazy val popup : Modal = Modal.okCancel("Warning!", "The mode change will erase all your code, are you sure?",
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

    val editorConfiguration = new EditorConfiguration(mode.codeMirrorMode, "native", true, "material")
    private val editor : Editor = CodeMirror.fromTextArea(textArea, editorConfiguration)
    //TODO think if it is to put outside or inside
    GlobalStore.get[Doc]("doc") match {
      case Success(doc) => editor.doc.setHistory(doc.getHistory())
      case _ =>
    }
    GlobalStore.put("doc", editor.doc)
    modeSelection.onClick(() => {
      if(mode == ScalaModeEasy) {
        val fullCode = ScalaModeEasy.convertToFull(this.getRaw())
        editor.setValue(fullCode)
        this.mode = ScalaModeFull
      } else {
        popup.show()
      }
    })
    EventBus.listen { case Example(_, code, _) => this.setCode(code, ScalaModeEasy) }
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

  def apply(textArea : TextArea) : EditorSection = {
    new EditorSectionImpl(textArea)
  }

  class ModeSelection(id : String) {
    val mode = $(s"#$id")
    def isChecked() : Boolean = mode.prop("checked").get.asInstanceOf[Boolean]
    def onClick(handler : () => Unit) : JQuery = mode.click((e : JQueryEventObject) => {
      handler()
    })
    def off() : Unit = mode.prop("checked",false).change()
    def on() : Unit = mode.prop("checked",true).change()
  }
}
