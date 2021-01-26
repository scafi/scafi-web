package it.unibo.scafi.js.facade.codemirror

import org.scalajs.dom.Element
import org.scalajs.dom.raw.HTMLTextAreaElement

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport
import scala.scalajs.js.|

//TODO alternatives : Aces.js https://ace.c9.io/ and https://github.com/microsoft/monaco-editor
@js.native
@JSImport("codemirror", JSImport.Namespace)
object CodeMirror extends js.Function2[Element, EditorConfiguration, Editor] {
  def fromTextArea(host: HTMLTextAreaElement, options: EditorConfiguration): Editor = js.native

  override def apply(arg1: Element, arg2: EditorConfiguration): Editor = js.native
}
@js.native
trait Editor extends js.Object {
  def save() : js.Any = js.native
  def getValue() : String = js.native
  def setValue(s : String) : js.Any = js.native
  def setOption(key : String, value : String) : js.Any = js.native
  def doc : Doc
  def swapDoc(doc : Doc) : Doc
  /*TODO*/
}

@js.native
trait Doc extends js.Object {
  def getValue() : String
  def getHistory() : History
  def setHistory(history : History) : Unit
  /*TODO*/
}

@js.native
trait History extends js.Object { /* TODO */ }
/*TODO enrich with more options*/
class EditorConfiguration(val value : String | Doc,
                          val mode : String,
                          val scrollbarStyle : String,
                          val lineNumbers : Boolean,
                          val theme : String) extends js.Object

