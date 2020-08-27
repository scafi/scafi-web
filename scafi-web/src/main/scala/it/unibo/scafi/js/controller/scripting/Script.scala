package it.unibo.scafi.js.controller.scripting

case class Script(lang : String, code : String)

object Script {
  def javascript(s : String) : Script = Script("javascript", s)
}
