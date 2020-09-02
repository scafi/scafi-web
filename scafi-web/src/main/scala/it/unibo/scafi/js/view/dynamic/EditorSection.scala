package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.facade.codemirror.{CodeMirror, Editor, EditorConfiguration}
import it.unibo.scafi.js.facade.simplebar.{SimpleBar, SimpleBarConfig}
import it.unibo.scafi.js.facade.simplebar.SimpleBarConfig.ForceX
import org.scalajs.dom.html
import org.scalajs.dom.html.TextArea
class EditorSection(textArea : TextArea, selection: html.Select, codeExample : Map[String, String]) {
  import scalatags.JsDom.all._
  val editor : Editor = CodeMirror.fromTextArea(textArea, new EditorConfiguration("javascript", "native", true))
  new SimpleBar(textArea, new SimpleBarConfig(forceVisible = ForceX)).recalculate()
  private val optionInSelect = codeExample.keys.map(key => option(value := key, key).render).toList
  optionInSelect.headOption.foreach( option => {
    option.selected = true
    editor.setValue(codeExample(option.value))
  })
  selection.onchange = _ => {
    val option = optionInSelect(selection.selectedIndex)
    editor.setValue(codeExample(option.value))
  }
  optionInSelect.foreach(option => selection.appendChild(option))
}
