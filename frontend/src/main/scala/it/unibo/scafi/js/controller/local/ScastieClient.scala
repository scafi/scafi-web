package it.unibo.scafi.js.controller.local

import it.unibo.scafi.js.view.dynamic.EditorSection.{Mode, ScalaModeEasy}
import it.unibo.scafi.standalone.RuntimeTemplate
import org.scalajs.dom.ext.Ajax

import scala.collection.mutable.ArrayBuffer
import scala.concurrent.{Future, Promise}
import scala.concurrent.ExecutionContext.Implicits.global
import scala.scalajs.js
import scala.scalajs.js.JSON

object ScastieClient {
  val baseUrl = "https://scastie.scala-lang.org"
  val scafiVersion = "1.1.0"
  val scalaV = "2.13.18"
  val scalaJsV = "1.21.0"

  def compile(code: String, mode: Mode): Future[String] = {
    val core = mode match {
      case ScalaModeEasy => ScalaModeEasy.convertToFull(code)
      case _             => code
    }
    val wrappedCode = RuntimeTemplate.wrapCode(core)
    val payload = buildPayload(wrappedCode)

    for {
      snippetId <- postRun(payload)
      jsContent <- waitForJs(snippetId)
    } yield jsContent
  }

  private def buildPayload(code: String): String = {
    val scala2Target = ujson.Obj("scalaVersion" -> scalaV)
    val jsTarget = ujson.Obj("scalaVersion" -> scalaV, "scalaJsVersion" -> scalaJsV)

    def dep(groupId: String, artifact: String) = ujson.Obj(
      "groupId" -> groupId,
      "artifact" -> artifact,
      "target" -> ujson.Obj("Scala2" -> scala2Target),
      "version" -> scafiVersion,
      "isAutoResolve" -> true
    )

    val payload = ujson.Obj(
      "SbtInputs" -> ujson.Obj(
        "isWorksheetMode" -> false,
        "code" -> code,
        "target" -> ujson.Obj("Js" -> jsTarget),
        "libraries" -> ujson.Arr(
          dep("it.unibo.scafi", "scafi-core"),
          dep("it.unibo.scafi", "scafi-commons"),
          dep("it.unibo.scafi", "scafi-simulator")
        ),
        "librariesFromList" -> ujson.Arr(),
        "sbtConfigExtra" -> "",
        "sbtPluginsConfigExtra" -> "",
        "isShowingInUserProfile" -> false
      )
    )
    ujson.write(payload)
  }

  private def postRun(payload: String): Future[String] = {
    Ajax
      .post(
        url = s"$baseUrl/api/run",
        data = Ajax.InputData.str2ajax(payload),
        headers = Map("Content-Type" -> "application/json")
      )
      .filter(_.status == 200)
      .map(_.responseText)
      .map { body =>
        JSON.parse(body).asInstanceOf[js.Dynamic].base64UUID.asInstanceOf[String]
      }
  }

  private def waitForJs(snippetId: String): Future[String] = {
    val promise = Promise[String]()
    val sseUrl = s"$baseUrl/api/progress-sse/$snippetId"
    val compilationErrors = ArrayBuffer.empty[String]
    val compilationWarnings = ArrayBuffer.empty[String]
    var runtimeMessage: Option[String] = None

    def failureMessage(default: String): String = {
      compilationErrors.lastOption
        .orElse(runtimeMessage)
        .orElse(compilationWarnings.lastOption)
        .getOrElse(default)
    }

    val es = js.Dynamic.newInstance(js.Dynamic.global.EventSource)(sseUrl)
    es.onmessage = { (event: js.Dynamic) =>
      val data = JSON.parse(event.data.toString).asInstanceOf[js.Dynamic]
      val isDone = data.isDone.asInstanceOf[Boolean]
      val compilationInfos = data.compilationInfos.asInstanceOf[js.Array[js.Dynamic]]
      val runtimeError = data.runtimeError.asInstanceOf[js.UndefOr[js.Dynamic]]
      val jsContent = data.selectDynamic("scalaJsContent")

      compilationInfos.foreach { info =>
        val message = info.message.asInstanceOf[String]
        val severity = info.severity.asInstanceOf[js.Dynamic]
        if (!js.isUndefined(severity.selectDynamic("Error"))) {
          compilationErrors += message
        } else {
          compilationWarnings += message
        }
      }
      runtimeError.toOption
        .filter(_ != null)
        .foreach { error =>
          runtimeMessage = Some(error.message.asInstanceOf[String])
        }

      if (isDone) {
        if (jsContent != null && !js.isUndefined(jsContent)) {
          val content = jsContent.asInstanceOf[String]
          if (content != null && content.nonEmpty) {
            promise.trySuccess(content)
          } else {
            promise.tryFailure(new RuntimeException(s"Compilation failed: ${failureMessage("Empty Scala.js content")}"))
          }
        } else {
          promise.tryFailure(new RuntimeException(s"Compilation failed: ${failureMessage("Unknown error")}"))
        }
        es.asInstanceOf[js.Dynamic].close()
      }
    }
    es.onerror = { (_: js.Dynamic) =>
      es.asInstanceOf[js.Dynamic].close()
      promise.tryFailure(new RuntimeException("SSE connection error"))
    }

    promise.future
  }
}
