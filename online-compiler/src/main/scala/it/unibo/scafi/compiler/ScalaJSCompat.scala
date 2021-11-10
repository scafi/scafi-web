package it.unibo.scafi.compiler

import it.unibo.scafi.compiler.cache.{AbstractFlatJar, FlatFileSystem, FlatJar}
import org.scalajs.linker.interface.unstable.{IRContainerImpl, IRFileImpl}
import org.scalajs.linker.interface.{IRFileCache, LinkerOutput, StandardConfig}
import org.scalajs.linker.{MemOutputFile, StandardImpl}

import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import scala.concurrent.duration.Duration
import scala.concurrent.{Await, ExecutionContext, Future}

object ScalaJSCompat {

  type Level = org.scalajs.logging.Level
  val Level = org.scalajs.logging.Level

  type ScalaJSCompilerPlugin = org.scalajs.nscplugin.ScalaJSPlugin

  type IRFile = org.scalajs.linker.interface.IRFile

  def memIRFile(path: String, content: Array[Byte]): IRFile =
    new MemIRFileImpl(path, content)

  def createGlobalIRCache(): IRFileCache =
    StandardImpl.irFileCache()

  type IRContainer = org.scalajs.linker.interface.IRContainer
  val IRContainer = org.scalajs.linker.interface.IRContainer

  def flatJarFileToIRContainer(jar: AbstractFlatJar, ffs: FlatFileSystem): IRContainer = {
    new FlatJarIRContainer(jar.flatJar, ffs)
  }

  def loadIRFilesInIRContainers(globalIRCache: IRFileCache, containers: Seq[IRContainer]): Seq[IRFile] = {
    import ExecutionContext.Implicits.global

    val cache  = globalIRCache.newCache
    val future = cache.cached(containers)
    Await.result(future, Duration.Inf)
  }

  type Semantics = org.scalajs.linker.interface.Semantics
  val Semantics = org.scalajs.linker.interface.Semantics

  type LinkerConfig = StandardConfig

  def defaultLinkerConfig: LinkerConfig =
    StandardConfig().withESFeatures(_.withAvoidLetsAndConsts(false)).withESFeatures(_.withAvoidClasses(false))

  type Linker = org.scalajs.linker.interface.Linker

  def createLinker(config: LinkerConfig): Linker =
    StandardImpl.linker(config)

  type MemJSFile = org.scalajs.linker.MemOutputFile

  type Logger = org.scalajs.logging.Logger

  def link(linker: Linker, irFiles: Seq[IRFile], logger: Logger): MemJSFile = {
    import scala.concurrent.ExecutionContext.Implicits.global

    val output       = MemOutputFile()
    val linkerOutput = LinkerOutput(output)
    val future       = linker.link(irFiles, Nil, linkerOutput, logger)
    Await.result(future, Duration.Inf)
    output
  }

  def memJSFileContentAsString(file: MemJSFile): String =
    new String(file.content, StandardCharsets.UTF_8)

  private final class MemIRFileImpl(path: String, content: Array[Byte]) extends IRFileImpl(path, None) {

    import org.scalajs.ir

    def entryPointsInfo(implicit ec: ExecutionContext): Future[ir.EntryPointsInfo] = {
      val buf             = ByteBuffer.wrap(content)
      val entryPointsInfo = ir.Serializers.deserializeEntryPointsInfo(buf)
      Future.successful(entryPointsInfo)
    }

    def tree(implicit ec: ExecutionContext): Future[ir.Trees.ClassDef] = {
      val buf      = ByteBuffer.wrap(content)
      val classDef = ir.Serializers.deserialize(buf)
      Future.successful(classDef)
    }
  }

  private final class FlatJarIRContainer(flatJar: FlatJar, ffs: FlatFileSystem)
      extends IRContainerImpl(flatJar.name, Some("immutable")) {

    override def sjsirFiles(implicit ec: ExecutionContext): Future[List[IRFile]] = {
      val irFiles = flatJar.files.filter(_.path.endsWith("sjsir")).map { file =>
        val content = ffs.load(flatJar, file.path)
        memIRFile(s"${flatJar.name}:${file.path}", content)
      }
      Future.successful(irFiles.toList)
    }
  }
}
