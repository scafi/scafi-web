package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.utils.Execution
import monix.execution.{Ack, CancelableFuture}
import monix.reactive.Observable
import monix.reactive.subjects.PublishSubject

import scala.concurrent.Future
import scala.scalajs.js.annotation.JSExportAll
/**
 * A very minimalistic event bus used to intercommunication between dynamic section part.
 * It uses Monix subject to create this event bus. It is like actor in akka platform.
 */
@JSExportAll
class EventBus {
  type Handler = PartialFunction[Any, Unit]
  private val bus: PublishSubject[Any] = PublishSubject()
  private val busObservable: Observable[Any] = bus.share(Execution.timeoutBasedScheduler)

  /**
   * A functional way to manage events emits by some source
   *
   * @param handler the handler called for each event
   * @return the cancellable future that can be used to stop listen aciton
   */
  def listen(handler: Handler): CancelableFuture[Unit] = {
    busObservable.filter(handler.isDefinedAt).foreach(handler)(Execution.timeoutBasedScheduler)
  }

  /**
   * Publish an event on the event bus
   *
   * @param event the event published
   * @return a Future that is completed when the publish is done
   */
  def publish(event: Any): Future[Ack] = bus.onNext(event)
}


