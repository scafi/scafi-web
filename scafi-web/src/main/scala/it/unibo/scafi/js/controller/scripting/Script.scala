package it.unibo.scafi.js.controller.scripting

/**
  * an object that wrap a script file.
  * @param lang the lang used to write the script (javascript, scala,...)
  * @param code the code written in the lang passed
  */
case class Script(lang : String, code : String)

object Script {
  /**
    * return a script with javascript lang selected
    */
  def javascript(code : String) : Script = Script("javascript", s)
}
