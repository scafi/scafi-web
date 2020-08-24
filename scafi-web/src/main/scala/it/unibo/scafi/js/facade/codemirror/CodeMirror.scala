package it.unibo.scafi.js.facade

import org.scalajs.dom.raw.HTMLTextAreaElement

import scala.scalajs.js
import scala.scalajs.js.annotation.JSImport

//TODO alternatives : Aces.js https://ace.c9.io/ and https://github.com/microsoft/monaco-editor
@js.native
@JSImport("codemirror", JSImport.Namespace)
object CodeMirror extends js.Object {
  def fromTextArea(host: HTMLTextAreaElement, options: EditorConfiguration): Editor = js.native
}
@js.native
trait Editor extends js.Object {
  def save() : js.Any = js.native
  def getValue() : String = js.native
  def setValue(s : String) : js.Any = js.native
  /*TODO*/
}
/*TODO enrich with more options*/
class EditorConfiguration(val mode : String, val scrollbarStyle : String, val lineNumbers : Boolean) extends js.Object

