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

import java.util.UUID
import scala.concurrent.ExecutionContextExecutor
import scala.io.{Codec, Source, StdIn}
import scala.util.{Failure, Success}

object Service {
  implicit val system : ActorSystem = ActorSystem()
  implicit val materializer : ActorMaterializer = ActorMaterializer()
  implicit val context : ExecutionContextExecutor =  system.dispatcher
  implicit val port = 8081 //todo put in configuration
  implicit val host = "localhost" //todo put in configuration
  val page : String = Source.fromInputStream(getClass.getClassLoader.getResourceAsStream("index.html")).mkString
  val code : String = Source.fromInputStream(getClass.getClassLoader.getResourceAsStream("scafi-web-opt-bundle.js"))(Codec("UTF-8")).mkString
  val webpack : String = code.split("""Object.freeze""")(0)

  var codeMap: Map[String, String] = Map("index.js" -> code)

  lazy val index : Route = get {
    path("") {
      complete(HttpEntity(ContentTypes.`text/html(UTF-8)`, page))
    }
  }

  lazy val jsCode : Route = get {
    path("js" / Segment) { id =>
      codeMap.get(id) match {
        case Some(id) => complete(HttpEntity(ContentTypes.`text/html(UTF-8)`, id))
        case _ => complete(StatusCodes.NotFound)
      }
    }
  }
  //for the first request
  lazy val target : Route = get {
    path("target" / Remaining) { _ =>
      complete(HttpEntity(ContentTypes.`text/html(UTF-8)`, code))
    }
  }

  lazy val compilatedPage : Route = get {
    path("compilation" / Segment) { id =>
      complete(HttpEntity(ContentTypes.`text/html(UTF-8)`, ScalaCompiledPage.html(id)))
    }
  }

  lazy val codeCompilationRequest : Route = post {
    path("code") {
      entity[String](as[String]) { code =>
        val compiled = ScafiCompiler.compile(code)
        compiled match {
          case Success(result) => val id = UUID.randomUUID().toString
            codeMap += (id -> (webpack + result))
            complete(id)
          case Failure(exception) => complete(StatusCodes.InternalServerError, exception.toString)
        }
      }
    }
  }

  def main(args: Array[String]): Unit = {
    val route : Route = concat(index, jsCode, compilatedPage, codeCompilationRequest, target)
    val bindingFuture = Http().newServerAt(host, port).bind(route)
    StdIn.readLine() // let it run until user presses return
    bindingFuture
      .flatMap(_.unbind()) // trigger unbinding from the port
      .onComplete(_ => system.terminate()) // and shutdown when done*/
  }
}
