package it.unibo.scafi.js.controller.local

import org.querki.jquery.$

import scala.concurrent.{Future, Promise}
import scala.scalajs.js
import scala.util.Success

object CompilationServers {
  def apply() : Future[js.Array[String]] = {
    val promise = Promise[js.Array[String]]
    $.getJSON("config/server.json", success = (json, result, xhr) => promise.complete(Success(json.asInstanceOf[js.Array[String]])))
    promise.future
  }
}
