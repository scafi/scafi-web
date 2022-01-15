package it.unibo.scafi.compiler

import it.unibo.scafi.js.view.dynamic.EditorSection.{Mode, ScalaModeEasy, ScalaModeFull}
import org.slf4j.LoggerFactory

import scala.util.{Failure, Success, Try}

object ScafiCompiler {
  val library = new LibraryManager(Seq.empty)
  val log = LoggerFactory.getLogger(getClass)

  def init(): Unit = {
    val compiler = new Compiler(library, "object CompilerInit {}")
    compiler.compile() match {
      case (_, Some(b)) =>
        compiler.fastOpt(b)
        log.debug("initialization success")
    }
  }
  def compilePure(code: String): Try[String] = {
    val compiler = new Compiler(library, code)
    val result = compiler.compile()
    result match {
      case (_, Some(b)) =>
        val res = compiler.fastOpt(b)
        val jsCode =
          s"""
            |{${compiler.`export`(res)}}
            |""".stripMargin
        Success(jsCode) // the {} usage allow to reval the same scala.js code in browser
      case (a, _) =>
        log.debug(a)
        Failure(new IllegalArgumentException(a))
    }
  }
  // TODO FIND A BETTER WAY HERE..
  def compileEasy(core: String): Try[String] =
    compileCode(ScalaModeEasy.convertToFull(core), core, ScalaModeEasy)
  def compile(core: String): Try[String] =
    compileCode(core, core, ScalaModeFull)

  def compileCode(core: String, showCode: String, mode: Mode): Try[String] = {
    val h = '"'
    val code = s"""
      |import it.unibo.scafi.js.view.dynamic.EditorSection.{ScalaModeFull, ScalaModeEasy}
      |import it.unibo.scafi.js.Index
      |import it.unibo.scafi.js.Index.configuration
      |import it.unibo.scafi.js.controller.scripting.Script.ScaFi
      |import it.unibo.scafi.js.view.dynamic.PageBus
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
      |     PageBus.publish(ScaFi(program))
      |     import it.unibo.scafi.js.controller.local.SupportConfiguration
      |     SupportConfiguration.loadGlobal().foreach {
      |       config => {
      |         Index.support.evolve(config)
      |         PageBus.publish(config)
      |       }
      |     }
      |  }
      |}
      |""".stripMargin
    val compiler = new Compiler(library, code)
    val result = compiler.compile()
    result match {
      case (_, Some(b)) =>
        val res = compiler.fastOpt(b)
        val jsCode =
          s"""
            |{${compiler.`export`(res)}}
            |Injector.main()
            |""".stripMargin
        Success(jsCode) // the {} usage allow to reval the same scala.js code in browser
      case (a, _) =>
        log.debug(a)
        Failure(new IllegalArgumentException(a))
    }
  }
}
