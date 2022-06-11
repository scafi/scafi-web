package it.unibo.scafi.compiler

import scala.annotation.tailrec
/* from https://github.com/scalafiddle/scalafiddle-core */
trait URLLib {
  val name: String
  val version: String
  val url: String

  def compareVersion(that: URLLib): Int = {
    val a = version.split('.').toList.map(_.toInt)
    val b = that.version.split('.').toList.map(_.toInt)

    @tailrec
    def compare(a: List[Int], b: List[Int]): Int = (a, b) match {
      case (Nil, Nil) => 0
      case (av :: tail, Nil) => 1
      case (Nil, bv :: tail) => -1
      case (av :: atail, bv :: btail) =>
        if (av == bv) {
          compare(atail, btail)
        } else if (av > bv) {

          1
        } else {
          -1
        }
    }

    compare(a, b)
  }
}

case class JSLib(name: String, version: String, url: String) extends URLLib

case class CSSLib(name: String, version: String, url: String) extends URLLib

case class ExtLib(
    group: String,
    artifact: String,
    version: String,
    compileTimeOnly: Boolean,
    jsLibs: Seq[JSLib] = Nil,
    cssLibs: Seq[CSSLib] = Nil
) {
  override def toString: String = s"$group ${if (compileTimeOnly) "%%" else "%%%"} $artifact % $version"

  def sameAs(other: ExtLib): Boolean =
    group == other.group && artifact == other.artifact && version == other.version && compileTimeOnly == other.compileTimeOnly
}

object ExtLib {
  private val repoSJSRE = """ *([^ %]+) *%%% *([^ %]+) *% *([^ %]+) *""".r
  private val repoRE = """ *([^ %]+) *%% *([^ %]+) *% *([^ %]+) *""".r

  def apply(libDef: String): ExtLib = libDef match {
    case repoSJSRE(group, artifact, version) =>
      ExtLib(group, artifact, version, false)
    case repoRE(group, artifact, version) =>
      ExtLib(group, artifact, version, true)
    case _ =>
      throw new IllegalArgumentException(s"Library definition '$libDef' is not correct")
  }

  private def tsort[A](edges: Traversable[(A, A)]): Iterable[A] = {
    @tailrec
    def tsort(toPreds: Map[A, Set[A]], done: Iterable[A]): Iterable[A] = {
      val (noPreds, hasPreds) = toPreds.partition(_._2.isEmpty)
      if (noPreds.isEmpty) {
        if (hasPreds.isEmpty) done else edges.toList.flatMap(x => List(x._1, x._2)).distinct
      } else {
        val found = noPreds.keys
        tsort(hasPreds.mapValues(_ -- found), done ++ found)
      }
    }

    val toPred = edges.foldLeft(Map[A, Set[A]]()) { (acc, e) =>
      acc + (e._1 -> acc.getOrElse(e._1, Set())) + (e._2 -> (acc.getOrElse(e._2, Set()) + e._1))
    }
    tsort(toPred, Seq())
  }

  def resolveLibs[T <: URLLib](libs: Seq[ExtLib], extract: ExtLib => Seq[T]): List[T] = {
    val libGroups = libs.map(extract(_)).filter(_.nonEmpty)
    // resolve latest version of each library
    val latestVersion =
      libGroups.flatten.groupBy(_.name).mapValues(_.sortWith((a, b) => a.compareVersion(b) >= 0).head)
    // resolve dependency ordering for libraries using a topological sort
    val namePairs =
      libGroups.flatMap(deps => ("" +: deps.map(_.name)).sliding(2).map(l => (l.head, l.tail.head)))

    tsort(namePairs).filter(_.nonEmpty).map(latestVersion).toList
  }
}
