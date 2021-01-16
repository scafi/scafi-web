package it.unibo.scafi.js.code

object LibraryExample {
  private val examples : Seq[Example] = Seq(
    Example.create("StandardSensors") {
      """//using StandardSensors
        |(currentPosition())
        |""".stripMargin
    },
    Example.create("BlockG") {
      ""
    },
    Example.create("BlockC") {
      ""
    },
    Example.create("BlockT") {
      ""
    },
    Example.create("BlockS") {
        """// using BlockS, StandardSensors
        |S(20, nbrRange)
        |""".stripMargin
    }
  )
  def apply() : ExampleGroup = ExampleGroup("Libraries", examples)
}
