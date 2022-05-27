package it.unibo.scafi.compiler

import akka.actor.ActorSystem
import akka.stream.ActorMaterializer
import coursier.maven.MavenRepository
import coursier.{Cache, Dependency, Fetch, Module, Resolution}
import it.unibo.scafi.compiler.ScalaJSCompat.{IRContainer, IRFile, flatJarFileToIRContainer, loadIRFilesInIRContainers}
import it.unibo.scafi.compiler.Service.getClass
import it.unibo.scafi.compiler.cache.{AbstractFlatFileSystem, AbstractFlatJar, FlatFileSystem, LRUCache}
import org.apache.maven.artifact.versioning.ComparableVersion
import org.slf4j.{Logger, LoggerFactory}
import scalaz.concurrent.Task
import scalaz.{-\/, \/-}

import java.io._
import java.net.URI
import java.nio.channels.{FileLock, OverlappingFileLockException}
import java.nio.file.Paths
import scala.concurrent.duration._
import scala.reflect.io.AbstractFile
/* from https://github.com/scalafiddle/scalafiddle-core */
/** Loads the jars that make up the classpath of the scala-js-fiddle compiler and re-shapes it into the correct
  * structure to satisfy scala-compile and scalajs-tools
  */
class LibraryManager(val depLibs: Seq[ExtLib]) {
  implicit val system: ActorSystem = ActorSystem()
  implicit val materializer: ActorMaterializer = ActorMaterializer()
  implicit val ec = system.dispatcher

  val log: Logger = LoggerFactory.getLogger(getClass)
  val timeout: FiniteDuration = 60.seconds

  def resourceStream(name: String, alternative: String = ""): (String, InputStream) = {

    val stream = getClass.getResourceAsStream(name)
    if (stream == null) {
      val stream = getClass.getResourceAsStream(alternative)
      if (stream == null) {
        throw new Exception(s"Classpath loading failed, jar $name or $alternative not found")
      }
      alternative -> stream
    } else {
      name -> stream
    }
  }

  def baseLibs: Seq[(String, InputStream)] = {
    Seq(
      resourceStream(s"/scala-library-${Config.scalaVersion}.jar", s"/scala-library.jar"),
      resourceStream(s"/scala-reflect-${Config.scalaVersion}.jar", s"/scala-reflect.jar"),
      resourceStream(s"/scalajs-library_${Config.scalaMainVersion}-${Config.scalaJSVersion}.jar")
    )
  }

  def scafiWebDependencies: Seq[(String, InputStream)] = {
    def loadFromJar: List[String] = {
      val c = getClass.getProtectionDomain.getCodeSource
      import java.util.zip.ZipInputStream
      val zip = new ZipInputStream(c.getLocation.openStream)
      val stream = Stream.continually(zip.getNextEntry).takeWhile(_ != null).toList
      stream.map(_.getName)
    }
    def loadFromLocal(): List[String] = {
      val root: Option[URI] = Option(getClass.getResource("/").toURI)
      root
        .map(uri => new File(uri))
        .map(file => file.listFiles())
        .map(files => files.map(_.getName).toList)
        .getOrElse(List.empty[String])

    }

    val names: List[String] = if (loadFromJar.isEmpty) {
      loadFromLocal()
    } else {
      loadFromJar
    }
    val scalaJsDep = names.filter(_.contains("sjs1_")).map(name => s"/$name")
    scalaJsDep.map(resourceStream(_))
  }

  val sjsVersion = s"_sjs${Config.scalaJSBinVersion}_${Config.scalaMainVersion}"

  val commonJars = {
    log.debug("Loading common libraries...")
    val jarFiles = baseLibs
    val bootFiles = for {
      prop <- Seq("sun.boot.class.path")
      path <- System.getProperty(prop).split(System.getProperty("path.separator"))
      vfile = scala.reflect.io.File(path)
      if vfile.exists && !vfile.isDirectory
    } yield {
      val name = "system/" + path.split(File.separatorChar).last
      log.debug(s"Loading resource $name")
      name -> vfile.inputStream()
    }
    log.debug("Common libraries loaded...")

    jarFiles ++ bootFiles ++ scafiWebDependencies
  }
  def loadCoursier(libs: Seq[ExtLib]) = {
    log.debug(s"Loading: $libs")

    val repositories = Seq(
      Cache.ivy2Local,
      MavenRepository("https://repo1.maven.org/maven2")
    )
    val exclusions = Set(
      ("org.scala-lang", "scala-reflect"),
      ("org.scala-lang", "scala-library"),
      ("org.scala-js", s"scalajs-library_${Config.scalaMainVersion}"),
      ("org.scala-js", s"scalajs-test-interface_${Config.scalaMainVersion}")
    )
    val results = Task
      .gatherUnordered(libs.map { lib =>
        val dep = lib match {
          case ExtLib(group, artifact, version, false, _, _) =>
            Dependency(Module(group, artifact + sjsVersion), version, exclusions = exclusions)
          case ExtLib(group, artifact, version, true, _, _) =>
            Dependency(Module(group, s"${artifact}_${Config.scalaMainVersion}"), version, exclusions = exclusions)
        }
        val start = Resolution(Set(dep))
        val fetch = Fetch.from(repositories, Cache.fetch())
        start.process.run(fetch).map(res => (lib, res))
      })
      .unsafePerformSync
    results.foreach { case (lib, r) =>
      val root = r.rootDependencies.head
      if (r.metadataErrors.nonEmpty) {
        log.error(r.metadataErrors.toString)
      }
      log.debug(s"Deps for ${root.moduleVersion}: ${r.minDependencies.size}")
      r.minDependencies.foreach { dep =>
        // log.debug(s"   ${dep.moduleVersion}")
      }
    }
    val depArts = results.flatMap(_._2.dependencyArtifacts).distinct

    val jars =
      Task
        .gatherUnordered(depArts.map(da => Cache.file(da._2).map(f => (da._1, f.toPath)).run))
        .unsafePerformSync
        .collect {
          case \/-((dep, path)) if path.toString.endsWith("jar") && dep.attributes.isEmpty =>
            (dep, path.toString, new FileInputStream(path.toFile))
          case -\/(error) =>
            throw new Exception(s"Unable to load a library: ${error.describe}")
        }

    // acquire an exclusive lock to prevent others from updating the FFS at the same time
    Paths.get(Config.libCache).toFile.mkdirs()
    val lockFile = Paths.get(Config.libCache).resolve("ffs.lck").toFile
    val lockChannel = new RandomAccessFile(lockFile, "rw").getChannel
    var lock: FileLock = null
    try {
      while (lock == null) {
        try
          lock = lockChannel.tryLock()
        catch {
          case e: OverlappingFileLockException =>
            lock = null
        }
        if (lock == null) {
          print("\rAcquiring lock...")
          Thread.sleep(1000)
        }
      }

      val ffs = FlatFileSystem.build(Paths.get(Config.libCache), jars.map(j => (j._2, j._3)) ++ commonJars)
      val absffs = new AbstractFlatFileSystem(ffs)

      val jarFlatFiles = jars.map(jar => (jar._1, absffs.roots(jar._2)))
      val commonJarFlatFiles = commonJars.map(jar => (jar._1, absffs.roots(jar._1))).toMap

      val commonLibs = commonJars.map { case (jar, _) => jar -> commonJarFlatFiles(jar) }
      val extLibMap = results.map { case (lib, resolution) =>
        (
          lib,
          resolution.minDependencies.flatMap(dep =>
            jarFlatFiles.find(_._1.moduleVersion == dep.moduleVersion).map(ff => (dep, ff._2))
          )
        )
      }.toMap

      (commonLibs, extLibMap, ffs)
    } finally {
      lock.release()
      lockChannel.close()
    }
  }

  def resolveDeps(deps: Seq[Dependency]): Seq[Dependency] = {
    deps
      .groupBy(_.module)
      .map { case (_, versions) =>
        // sort by version, select latest
        versions.maxBy(lib => new ComparableVersion(lib.version))
      }
      .toSeq
  }

  /** External libraries loaded from repository */
  log.debug("Loading external libraries")
  val (commonLibs, extLibraries, ffs) = loadCoursier(depLibs)

  val flatDeps = extLibraries.flatMap(_._2).groupBy(_._1).mapValues(_.head._2)

  /** The loaded files shaped for Scala-Js-Tools to use */
  def lib4linker(file: AbstractFlatJar): IRContainer =
    flatJarFileToIRContainer(file, ffs)

  /** In memory cache of all the jars used in the compiler. This takes up some memory but is better than reaching all
    * over the filesystem every time we want to do something.
    */
  val commonLibraries4compiler = commonLibs.map { case (name, data) => data.root }.seq
  val dependency4compiler = flatDeps.map { case (dep, data) => dep -> data.root }.seq

  /** In memory cache of all the jars used in the linker. */
  val commonLibraries4linker = commonLibs.map { case (name, file) => lib4linker(file) }
  val dependency4linker = flatDeps.map { case (dep, file) => dep -> lib4linker(file) }

  def deps(extLibs: Set[ExtLib]) = {
    val resolved = resolveDeps(extLibs.flatMap(lib => extLibraries(lib).map(_._1)).toList)
    // log.debug(s"Resolved libraries: ${resolved.map(_.moduleVersion)}")
    resolved
  }

  def compilerLibraries(extLibs: Set[ExtLib]): Seq[AbstractFile] = {
    val libs = commonLibraries4compiler ++ deps(extLibs).map(dep => dependency4compiler(dep))
    log.debug(s"Compiler libraries: ${libs.map(_.path)}")
    libs
  }

  val irCache = ScalaJSCompat.createGlobalIRCache()
  val linkerCaches = new LRUCache[Seq[IRFile]]("IRFiles")

  def linkerLibraries(extLibs: Set[ExtLib]): Seq[IRFile] = {
    this.synchronized {
      linkerCaches.getOrUpdate(
        extLibs, {
          val loadedJars = commonLibraries4linker ++ deps(extLibs).map(dep => dependency4linker(dep))
          loadIRFilesInIRContainers(irCache, loadedJars)
        }
      )
    }
  }
}
