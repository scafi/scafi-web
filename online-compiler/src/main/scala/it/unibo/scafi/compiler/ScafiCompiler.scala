package it.unibo.scafi.compiler

import scala.util.{Failure, Success, Try}

object ScafiCompiler {
  val library = new LibraryManager(Seq.empty)
  def compile(core: String): Try[String] = {
    val h = '"'
    val code = s"""
        |import it.unibo.scafi.js.Index
        |import it.unibo.scafi.js.Index.configuration
        |import it.unibo.scafi.js.controller.scripting.Script.ScaFi
        |import it.unibo.scafi.js.view.dynamic.EventBus
        |import it.unibo.scafi.js.view.dynamic.EditorSection
        |import scala.scalajs.js.annotation.{JSExport, JSExportTopLevel, JSGlobal, JSExportAll}
        |@JSExportTopLevel("Injector")
        |@JSExportAll
        |object Injector {
        |  val incarnation = Index.incarnation
        |  import incarnation._
        |  def main() {
        |     Index.main(Array())
        |     $core
        |     Index.editor.editor.setValue($h$h$h$core$h$h$h)
        |     EventBus.publish(ScaFi(program))
        |  }
        |}
        |""".stripMargin

    val compiler = new Compiler(library, code)
    val result   = compiler.compile()
    result match {
      case (_, Some(b)) =>
        val res = compiler.fastOpt(b)
        Success(compiler.`export`(res))
      case (a, _) => Failure(throw new IllegalArgumentException(a))
    }
  }
}
