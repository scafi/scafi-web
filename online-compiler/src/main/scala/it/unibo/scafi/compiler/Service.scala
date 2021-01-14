package it.unibo.scafi.compiler

/*
 * Copyright (C) 2020 Lightbend Inc. <https://www.lightbend.com>
 */

import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.model._
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.Route
import akka.stream.ActorMaterializer
import it.unibo.scafi.compiler.cache.CodeCache
import org.slf4j.LoggerFactory

import java.util.UUID
import scala.concurrent.ExecutionContextExecutor
import scala.io.{Codec, Source}
import scala.util.{Failure, Success}

object Service {
  val log = LoggerFactory.getLogger(getClass)
  implicit val system : ActorSystem = ActorSystem()
  implicit val materializer : ActorMaterializer = ActorMaterializer()
  implicit val context : ExecutionContextExecutor =  system.dispatcher
  val defaultPort = 8080
  val port = Option(System.getenv("PORT")).map(_.toInt).getOrElse(defaultPort) //todo put in configuration
  val host = "0.0.0.0" //todo put in configuration
  val indexJs = "scafi-web-opt-bundle.js"
  val commonsCode = "common.js"
  val page : String = Source.fromInputStream(getClass.getClassLoader.getResourceAsStream("index-server.html")).mkString
  val code : String = Source.fromInputStream(getClass.getClassLoader.getResourceAsStream(indexJs))(Codec("UTF-8")).mkString
  val codeDivision = code.split("Object.freeze")
  val webpack : String = codeDivision(0)
  val core = codeDivision(1)
  val codeCacheLimit = 5
  val runtime = Runtime.getRuntime
  var codeCache: CodeCache = CodeCache.limit(codeCacheLimit)
    .permanent(indexJs, core)
    .permanent(commonsCode, webpack)


  lazy val index : Route = get {
    path("") {
      complete(HttpEntity(ContentTypes.`text/html(UTF-8)`, page))
    }
  }

  lazy val jsCode : Route = get {
    path("js" / Segment) { id =>
      codeCache.get(id) match {
        case Some(id) => complete(HttpEntity(ContentTypes.`text/html(UTF-8)`, id))
        case _ => complete(StatusCodes.NotFound)
      }
    }
  }

  lazy val compilatedPage : Route = get {
    path("compilation" / Segment) { id =>
      complete(HttpEntity(ContentTypes.`text/html(UTF-8)`, ScalaCompiledPage.html(id)))
    }
  }

  lazy val pureCodeRequest : Route = post {
    path("pure" / "code") {
      entity[String](as[String]) { code =>
        val compiled = ScafiCompiler.compilePure(code)
        compiled match {
          case Success(result) => val id = UUID.randomUUID().toString
            codeCache = codeCache put(id, (result))
            complete(id)
          case Failure(exception) => {
            complete(StatusCodes.InternalServerError, exception.getMessage)
          }
        }
      }
    }
  }
  lazy val codeCompilationRequest : Route = post {
    path("code") {
      entity[String](as[String]) { code =>
        val compiled = ScafiCompiler.compile(code)
        compiled match {
          case Success(result) => val id = UUID.randomUUID().toString
            codeCache = codeCache put (id, (result))
            log.debug("done : " + id)
            log.debug("occupied ram : " + (runtime.totalMemory() - runtime.freeMemory()) / 1000000.0 + " Mb")
            complete(id)
          case Failure(exception) => {
            complete(StatusCodes.InternalServerError, exception.getMessage)
          }
        }
      }
    }
  }

  def main(args: Array[String]): Unit = {
    ScafiCompiler.init()
    val route = concat(index, jsCode, compilatedPage, codeCompilationRequest, pureCodeRequest)
    val bindingFuture = Http().newServerAt(host, port).bind(route)
  }
}
