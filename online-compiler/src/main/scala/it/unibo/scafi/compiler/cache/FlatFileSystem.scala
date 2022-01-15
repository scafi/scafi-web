package it.unibo.scafi.compiler.cache

import akka.actor.ActorSystem
import com.google.javascript.jscomp.jarjar.com.google.common.io.Files.getFileExtension
import org.xerial.snappy.Snappy
import upickle.default._
import xerial.larray.mmap.MMapMode
import xerial.larray.{LArray, MappedLByteArray, RawByteArray}

import java.io.{FileOutputStream, InputStream}
import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path}
import java.util.zip.{ZipEntry, ZipInputStream}
import scala.io.Source
import scala.reflect.io.Streamable
/* from https://github.com/scalafiddle/scalafiddle-core */
case class FlatFile(path: String, offset: Long, compressedSize: Int, origSize: Int)

case class FlatJar(name: String, files: Seq[FlatFile])

class FlatFileSystem(data: MappedLByteArray, val jars: Seq[FlatJar], val index: Map[String, FlatFile]) {

  def exists(path: String) = index.contains(path)

  def load(flatJar: FlatJar, path: String): Array[Byte] =
    load(jars.find(_.name == flatJar.name).get.files.find(_.path == path).get)

  def load(path: String): Array[Byte] =
    load(index(path))

  def load(file: FlatFile): Array[Byte] = {
    val address = data.address + file.offset
    val content = LArray.of[Byte](file.origSize).asInstanceOf[RawByteArray[Byte]]

    Snappy.rawUncompress(address, file.compressedSize, content.address)
    val bytes = Array.ofDim[Byte](file.origSize)
    content.writeToArray(0, bytes, 0, file.origSize)
    content.free
    bytes
  }

  def filter(f: Set[String]): FlatFileSystem = {
    val newJars = jars.filter(j => f.contains(j.name))
    new FlatFileSystem(data, newJars, FlatFileSystem.createIndex(newJars))
  }
}

object FlatFileSystem {
  implicit val system = ActorSystem()
  val log = system.log

  def apply(location: Path): FlatFileSystem = {
    location.toFile.mkdirs()
    val jars = readMetadata(location)
    val index: Map[String, FlatFile] = createIndex(jars)
    val data = LArray.mmap(location.resolve("data").toFile, MMapMode.READ_ONLY)
    new FlatFileSystem(data, jars, index)
  }

  private def createIndex(jars: Seq[FlatJar]): Map[String, FlatFile] =
    jars.flatMap(_.files.map(file => (file.path, file)))(collection.breakOut)

  private def readMetadata(location: Path): Seq[FlatJar] =
    read[Seq[FlatJar]](Source.fromFile(location.resolve("index.json").toFile, "UTF-8").getLines.mkString)

  private val validExtensions = Set("class", "sjsir")
  private def validFile(entry: ZipEntry) =
    !entry.isDirectory &&
      validExtensions.contains(getFileExtension(entry.getName))

  def build(location: Path, jars: Seq[(String, InputStream)]): FlatFileSystem = {
    // if metadata already exists, read it in
    val existingJars =
      if (location.resolve("index.json").toFile.exists()) readMetadata(location) else Seq.empty[FlatJar]

    val newJars = jars.filterNot(p => existingJars.exists(_.name == p._1))

    // make location path
    location.toFile.mkdirs()

    val dataFile = location.resolve("data").toFile
    val fos = new FileOutputStream(dataFile, true)
    var offset = dataFile.length()

    // read through all new JARs, append contents to data and create metadata
    val addedJars = newJars.map { jarPath =>
      val name = jarPath._1
      log.debug(s"Extracting JAR $name")
      val fis = jarPath._2
      val jarStream = new ZipInputStream(fis)
      val entries = Iterator
        .continually(jarStream.getNextEntry)
        .takeWhile(_ != null)
        .filter(validFile)

      val files = entries.map { entry =>
        // read and compress the file
        val content = Streamable.bytes(jarStream)
        val compressed = Snappy.compress(content)
        fos.write(compressed)
        val ff = FlatFile(entry.getName, offset, compressed.length, content.length)
        offset += compressed.length
        ff
      }.toList
      jarStream.close()
      FlatJar(name, files)
    }
    fos.close()

    val finalJars = existingJars ++ addedJars
    val json = write(finalJars)
    Files.write(location.resolve("index.json"), java.util.Arrays.asList(json), StandardCharsets.UTF_8)

    val data = LArray.mmap(location.resolve("data").toFile, MMapMode.READ_ONLY)
    new FlatFileSystem(data, finalJars, createIndex(finalJars))
  }
}
