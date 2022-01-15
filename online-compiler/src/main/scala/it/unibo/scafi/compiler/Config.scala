package it.unibo.scafi.compiler

import java.util.Properties

import com.typesafe.config.ConfigFactory
/* from https://github.com/scalafiddle/scalafiddle-core */
case class Template(pre: String, post: String) {
  def fullSource(src: String) = pre + src + post
}

object Config {
  protected val config = ConfigFactory.load().getConfig("fiddle")

  val interface = config.getString("interface")
  val port = config.getInt("port")
  val routerUrl = config.getString("routerUrl")
  val secret = config.getString("secret")

  val libCache = config.getString("libCache")
  val compilerCacheSize = config.getInt("compilerCacheSize")

  // read the generated version data
  protected val versionProps = new Properties()
  versionProps.load(getClass.getResourceAsStream("/version.properties"))
  val version = versionProps.getProperty("version")
  val scalaVersion = versionProps.getProperty("scalaVersion")
  val scalaMainVersion = scalaVersion.split('.').take(2).mkString(".")
  val scalaJSVersion = versionProps.getProperty("scalaJSVersion")
  val aceVersion = versionProps.getProperty("aceVersion")

  val scalaJSBinVersion = "1"

}
