package it.unibo.scafi.js.controller

import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.model.Graph
import monix.reactive.Observable
import monix.reactive.subjects.PublishSubject

import scala.concurrent.Future

/**
  * the main abstraction used to wrap an aggregate system backend
  * into a set of operation that could be done via frontend.
  * Most of methods return Future[...] because the backend could be remotely instaced.
  * @tparam BACKEND the backend type
  * @tparam CONFIG the configuration type
  */
trait AggregateSystemSupport[BACKEND, CONFIG, SE] {
  /**
    * internal representation of the real aggregate system.
    * it is used by component to perform operation/ read system state.
    */
  protected def backend : BACKEND

  /**
    * a stream of side effect done in the backend. This is useful for declare a changing in the backend and update the graph representation consequently
    */
  protected def sideEffectsStream : PublishSubject[SE]

  /**
    * alter current backend with a configuration object
    * @return Future.success if the backend is changed of Future.failure(exc) if there were problems in evolving.
    */
  def evolve(config: CONFIG) : Future[Unit]

  /**
    * a stream of snapshot (Graph) that describe the backend system. This stream can be used by view to render the
    * backend system. A way to take only a sample of graph could be:
    *
    * support.graphStream.sample(FiniteDuration(100, TimeUnit.MILLISECONDS).foreach(graph => ...)
    */
  def graphStream : Observable[Graph]
}

/**
  * define an execution platform for loading script into an aggregate system.
  * This is a component to enrich the AggregateSystemSupport. This trait must be
  * mixed in with a subtype of AggregateSystemSupport[BACKEND, _, SE]
  * @tparam BACKEND the backend type
  * @tparam EXECUTION wrap the instance of the execution abstraction linked to the script loaded
  */
trait ExecutionPlatform[BACKEND, SE, EXECUTION] {
  self : AggregateSystemSupport[BACKEND, _, SE] =>
  /**
    * try to load a Script into the backend system.
    * @return Future.success(Execution) if the script is supported by backend, Future.failure(exc) otherwise.
    */
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
  /**
    * try to execute and interpret the command into the backend instance
    * @return Future.success(RESULT) if the command is evaluated, Future.failure(exc) if there are problems during evaluation.
    */
  def execute(command : COMMAND) : Future[RESULT]
}
