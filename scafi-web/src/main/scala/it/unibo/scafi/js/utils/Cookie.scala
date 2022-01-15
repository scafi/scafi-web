package it.unibo.scafi.js.utils

import org.scalajs.dom.document

import scala.concurrent.duration.FiniteDuration
import scala.scalajs.js.Date
import scala.scalajs.js.annotation.{JSExport, JSExportTopLevel}
@JSExportTopLevel("Cookie")
object Cookie {
  def storeWithTemporalLimit(key: String, data: String, finiteDuration: FiniteDuration): Unit = {
    val date = new Date()
    date.setTime(date.getTime() + finiteDuration.length)
    document.cookie = s"$key=$data; expires=${date.toUTCString()};"
  }
  @JSExport
  def store(key: String, data: String): Unit =
    document.cookie = s"$key=$data"
  @JSExport
  def has(key: String): Boolean = all().contains(key)
  @JSExport
  def clear(): Unit = all().keys.foreach(remove)
  def all(): Map[String, String] = document.cookie
    .replaceAll("\\s", "")
    .split(";")
    .map(_.split("=").toList)
    .map(arr => (arr.headOption, arr.tail.headOption))
    .collect { case (Some(key), Some(value)) => key -> value }
    .toMap
  def get(key: String): Option[String] = all().get(key)
  @JSExport
  def remove(key: String): Unit = document.cookie = s"$key=; expires=Thu, 01 Jan 1970 00:00:00 UTC;"
}
