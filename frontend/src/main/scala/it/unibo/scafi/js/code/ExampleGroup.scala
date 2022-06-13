package it.unibo.scafi.js.code

import upickle.default._

case class ExampleGroup(groupName: String, examples: Seq[Example])
object ExampleGroup {
  implicit def exampleGroupRW: ReadWriter[ExampleGroup] = macroRW[ExampleGroup]
}
