package it.unibo.scafi.js.controller.local

import org.querki.jquery.$
import org.scalajs.dom.XMLHttpRequest

import scala.concurrent.{Future, Promise}
import scala.scalajs.js
import scala.util.Success

object CompilationServers {
  def apply() : Future[js.Array[String]] = {
    val promise = Promise[js.Array[String]]
    $.getJSON("config/server.json", success = (json, result, xhr) => promise.complete(Success(json.asInstanceOf[js.Array[String]])))
    promise.future
  }

  def isReachable(server : String) : Boolean = {
    println(server)
    val xhr = new XMLHttpRequest()
    xhr.open(
      "HEAD",
      url = server,
      async = false //todo this should return a promise, ok for now but a more robust method is needed
    )
    try {
      xhr.send();
      val status = xhr.status;
      ( status >= 200 && status < 300 || status == 304 );
    } catch {
      case _ : Exception => false
    }
  }
}
