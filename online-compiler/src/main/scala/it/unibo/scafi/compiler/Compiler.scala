package it.unibo.scafi.compiler

import it.unibo.scafi.compiler.ScalaJSCompat._
import it.unibo.scafi.compiler.cache.{AutoCompleteCache, CompilerCache, LinkerCache}
import org.scalajs.linker.interface.ModuleKind
import org.slf4j.LoggerFactory

import scala.reflect.internal.util.Position
import scala.reflect.io
import scala.tools.nsc.Settings
import scala.tools.nsc.reporters.StoreReporter
/* from https://github.com/scalafiddle/scalafiddle-core */
/** Handles the interaction between scala-js-fiddle and scalac/scalajs-tools to compile and optimize code submitted by
  * users.
  */
class Compiler(libManager: LibraryManager, code: String) { self =>
  private val fileName = "ScafiWeb.scala"
  val log = LoggerFactory.getLogger(getClass)
  private val sjsLogger = new Log4jLogger()
  private val dependencyRE = """ *// \$FiddleDependency (.+)""".r
  private val codeLines = code.replaceAll("\r", "").split('\n')
  private val extLibDefs = codeLines.collect { case dependencyRE(dep) =>
    dep
  }.toSet

  private lazy val extLibs: Set[ExtLib] = {
    val userLibs = extLibDefs
      .map(lib => ExtLib(lib))
      .map(extLib =>
        libManager.depLibs
          .find(_.sameAs(extLib))
          .getOrElse(throw new IllegalArgumentException(s"Library $extLib is not allowed"))
      )
      .toList

    log.debug(s"Full dependencies: $userLibs")
    userLibs.toSet
  }

  /** Converts a bunch of bytes into Scalac's weird VirtualFile class */
  private def makeFile(src: Array[Byte]) = {
    val singleFile = new io.VirtualFile(fileName)
    val output = singleFile.output
    output.write(src)
    output.close()
    singleFile
  }

  def autocomplete(pos: Int): List[(String, String)] = {
    val startTime = System.nanoTime()
    val compiler = AutoCompleteCache.getOrUpdate(
      extLibs, {
        val vd = new io.VirtualDirectory("(memory)", None)
        val settings = new Settings
        settings.outputDirs.setSingleOutput(vd)
        settings.processArgumentString("-Ypresentation-any-thread -Ypartial-unification")
        GlobalInitCompat.initInteractiveGlobal(settings, new StoreReporter, libManager.compilerLibraries(extLibs))
      }
    )

    compiler.reporter.reset()
    val startOffset = pos
    val source = code.take(startOffset) + "_CURSOR_ " + code.drop(startOffset)
    val unit = compiler.newCompilationUnit(source, fileName)
    val richUnit = new compiler.RichCompilationUnit(unit.source)
    // log.debug(s"Source: ${source.take(startOffset)}${scala.Console.RED}|${scala.Console.RESET}${source.drop(startOffset)}")
    compiler.unitOfFile(richUnit.source.file) = richUnit
    val results = compiler.completionsAt(richUnit.position(startOffset)).matchingResults()

    val endTime = System.nanoTime()
    log.debug(s"AutoCompletion time: ${(endTime - startTime) / 1000} us")
    log.debug(s"AutoCompletion results: ${results.take(20)}")

    results.map(r => (r.sym.signatureString, r.symNameDropLocal.decoded)).distinct
  }

  def compile(logger: String => Unit = _ => ()): (String, Option[Seq[IRFile]]) = {

    val startTime = System.nanoTime()
    log.debug("Compiling source:\n" + code)
    val singleFile = makeFile(code.getBytes("UTF-8"))

    val vd = new io.VirtualDirectory("(memory)", None)

    val compiler = CompilerCache.getOrUpdate(
      extLibs, {
        val settings = new Settings
        settings.processArgumentString("-Ydebug -Ypartial-unification -Ylog-classpath")
        GlobalInitCompat.initGlobal(settings, new StoreReporter, libManager.compilerLibraries(extLibs))
      }
    )

    compiler.reporter.reset()
    compiler.settings.outputDirs.setSingleOutput(vd)
    try {
      val run = new compiler.Run()
      run.compileFiles(List(singleFile))

      val endTime = System.nanoTime()
      log.debug(s"Scalac compilation: ${(endTime - startTime) / 1000} us")
      // print errors
      val errors = compiler.reporter
        .asInstanceOf[StoreReporter]
        .infos
        .map { info =>
          val label = info.severity.toString match {
            case "ERROR"   => "error: "
            case "WARNING" => "warning: "
            case "INFO"    => ""
          }
          Position.formatMessage(info.pos, label + info.msg, false)
        }
        .mkString("\n")
      if (vd.iterator.isEmpty) {
        (errors, None)
      } else {
        val things = for {
          x <- vd.iterator.to[collection.immutable.Traversable]
          if x.name.endsWith(".sjsir")
        } yield ScalaJSCompat.memIRFile(x.path, x.toByteArray)
        (errors, Some(things.toSeq))
      }
    } catch {
      case e: Throwable =>
        CompilerCache.remove(extLibs)
        throw e
    }
  }

  def export(output: MemJSFile): String =
    memJSFileContentAsString(output)

  def fastOpt(userFiles: Seq[IRFile]): MemJSFile =
    link(userFiles, fullOpt = false)

  def fullOpt(userFiles: Seq[IRFile]): MemJSFile =
    link(userFiles, fullOpt = true)

  def link(userFiles: Seq[IRFile], fullOpt: Boolean): MemJSFile = {
    val semantics =
      if (fullOpt) Semantics.Defaults.optimized
      else Semantics.Defaults

    val linkerConfig =
      defaultLinkerConfig
        .withSemantics(semantics)
        .withSourceMap(false)
        .withModuleKind(ModuleKind.CommonJSModule)
        .withClosureCompilerIfAvailable(fullOpt)

    // add parameters as fake libraries to make caching work correctly
    val libs = extLibs + ExtLib("semantics", "optimized", fullOpt.toString, false)

    try {
      val linker = LinkerCache.getOrUpdate(libs, createLinker(linkerConfig))
      val allIRFiles = libManager.linkerLibraries(extLibs) ++ userFiles
      ScalaJSCompat.link(linker, allIRFiles, sjsLogger)
    } catch {
      case e: Throwable =>
        LinkerCache.remove(libs)
        throw e
    }
  }

  def getExtDeps: (List[JSLib], List[CSSLib]) =
    (ExtLib.resolveLibs(extLibs.toList, _.jsLibs.toList), ExtLib.resolveLibs(extLibs.toList, _.cssLibs.toList))

  def getLog: Vector[String] = sjsLogger.logLines

  def getInternalLog: Vector[String] = sjsLogger.internalLogLines

  class Log4jLogger(minLevel: Level = Level.Debug) extends Logger {
    var logLines = Vector.empty[String]
    var internalLogLines = Vector.empty[String]

    def log(level: Level, message: => String): Unit = if (level >= minLevel) {
      if (level == Level.Warn || level == Level.Error) {
        logLines :+= message
      }
      internalLogLines :+= message
    }

    def success(message: => String): Unit = info(message)
    def trace(t: => Throwable): Unit =
      self.log.error("Compilation error", t)
  }

}
