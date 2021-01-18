package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.code.{Example, ExampleGroup}
import it.unibo.scafi.js.view.dynamic.EditorSection.ScalaModeEasy
import org.scalajs.dom.html
import scalatags.JsDom.all._
class ExampleChooser(examples: html.Select, exampleGroups : Seq[ExampleGroup], config : ConfigurationSection, editor : EditorSection) {
  private val codeExample = exampleGroups.flatMap(_.examples)
  private val optionGroups = exampleGroups.map(group => group.groupName -> optionInSelect(group.examples))
  private val options = optionGroups.flatMap(_._2)
  private def optionInSelect(examples : Seq[Example]) : List[html.Option] = examples.map(example => option(value := example.name, example.name).render).toList
  optionGroups.headOption.flatMap { case (group, examples) => examples.headOption } foreach {
    option => {
      option.selected = true
      loadExample(option.value)
    }
  }
  optionGroups.map { case (groupName, examples) => optgroup(attr("label") := groupName, examples).render }
    .foreach(group => examples.appendChild(group))
  examples.onchange = _ => {
    val option = options(examples.selectedIndex)
    loadExample(option.value)
  }
  private def loadExample(name : String) : Unit = codeExample.find(_.name == name) match {
    case Some(code) => editor.setCode(code.body, ScalaModeEasy)
      config.updateDeviceShape(code.devices)
    case _ =>
  }
}