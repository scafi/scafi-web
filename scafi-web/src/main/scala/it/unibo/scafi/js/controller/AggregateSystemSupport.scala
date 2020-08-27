package it.unibo.scafi.js.controller

import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.model.Graph
import monix.reactive.Observable
import monix.reactive.subjects.PublishSubject

import scala.concurrent.Future

/**
  * the main abstract used to wrap an aggregate system backend
  * into a set of operation that could be done via frontend.
  * @tparam BACKEND the backend type
  * @tparam CONFIG the configuration type
  */
trait AggregateSystemSupport[BACKEND, CONFIG, SE] {
  protected def backend : BACKEND
  protected def sideEffectsStream : PublishSubject[SE]
  def evolve(config: CONFIG) : Future[Unit]
  def graphStream : Observable[Graph]
}

/**
  * define an execution platform for load script into an aggregate system.
  * @tparam BACKEND the backend type
  * @tparam EXECUTION the execution type
  */
trait ExecutionPlatform[BACKEND, SE, EXECUTION] {
  self : AggregateSystemSupport[BACKEND, _, SE] =>
  def loadScript(script : Script) : Future[EXECUTION]
}

/**
  * an abstraction used to manage a set of command sent by a frontend
  * @tparam BACKEND the backend type
  * @tparam COMMAND a data structure used to define a command
  * @tparam RESULT the result of command execution
  */
trait CommandInterpreter[BACKEND, SE, COMMAND, RESULT] {
  self : AggregateSystemSupport[BACKEND, _, SE] =>
  def execute(command : COMMAND) : Future[RESULT]
}
