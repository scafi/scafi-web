package it.unibo.scafi.compiler

/*
 * Copyright (C) 2020 Lightbend Inc. <https://www.lightbend.com>
 */

import akka.actor.ActorSystem
import akka.http.scaladsl.Http
import akka.http.scaladsl.model._
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.{PathMatcher, Route}
import akka.stream.ActorMaterializer
import akka.stream.scaladsl.StreamConverters
import it.unibo.scafi.compiler.cache.CodeCache
import org.slf4j.LoggerFactory

import java.util.UUID
import scala.concurrent.ExecutionContextExecutor
import scala.io.{Codec, Source}
import scala.util.{Failure, Success, Try}

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

  lazy val resourceLike = Seq(resourcePath("resources"), resourcePath("fonts"), resourcePath("icons"))
  lazy val compilatedPage : Route = get {
    path("compilation" / Segment) { id =>
      complete(HttpEntity(ContentTypes.`text/html(UTF-8)`, ScalaCompiledPage.html(id)))
    }
  }

  lazy val pureCodeRequest : Route = post {
    compileRoot((compiler, code) => compiler.compilePure(code), "code" / "pure")
  }

  lazy val fullCode : Route = post {
    compileRoot((compiler, code) => compiler.compile(code), "code")
  }

  lazy val easyCode : Route = post {
    compileRoot((compiler, code) => compiler.compileEasy(code), "code" / "easy")
  }

  def resourcePath(basePath : PathMatcher[Unit]) : Route = {
    path(basePath / Segment) {
      name => {
        val resource = StreamConverters.fromInputStream(() => getClass.getClassLoader.getResourceAsStream(name))
        complete(HttpEntity(ContentTypes.`application/octet-stream`, resource))
      }
    }
  }
  def compileRoot(logic : (ScafiCompiler.type, String) => Try[String], pathMatch : PathMatcher[Unit]) : Route = {
    path(pathMatch) {
      entity[String](as[String]) { code =>
        val compiled = this.synchronized { logic(ScafiCompiler, code) }
        compiled match {
          case Success(result) => val id = UUID.randomUUID().toString
            this.synchronized { codeCache = codeCache put (id, (result)) } //fix
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
    val allRoutes = Seq(index, jsCode, compilatedPage, fullCode, easyCode, pureCodeRequest) ++ resourceLike
    val route = concat(allRoutes:_*)
    val bindingFuture = Http().newServerAt(host, port).bind(route)
  }
}
