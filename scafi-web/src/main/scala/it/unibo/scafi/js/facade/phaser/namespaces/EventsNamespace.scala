package it.unibo.scafi.js.facade.phaser.namespaces

import scala.scalajs.js
import scala.scalajs.js.ThisFunction

@js.native
trait EventsNamespace extends js.Object {
  @js.native
  trait EventEmitter extends js.Object {
    /* methods */
    def addListener(event : String, fn : ThisFunction, context : js.Any = js.native) : Unit = js.native
    def destroy() : Unit = js.native
    def emit(event : String, args : js.Any = js.native) : Boolean = js.native
    def eventNames() : js.Array[String] = js.native
    def listenerCounter(event : String): Int = js.native
    def listeners(event : String) : js.Array[js.Function] = js.native
    def off(event : String, fn : ThisFunction = js.native, context : js.Any = js.native, once : Boolean = js.native) : Unit = js.native
    def on(event : String, fn : ThisFunction, context : js.Any = js.native) : Unit = js.native
    def once(event : String, fn : ThisFunction, context : js.Any = js.native) : Unit = js.native
    def removeAllListeners(event : String) : Unit = js.native
    def removeListener(event : String, fn : ThisFunction = js.native, context : js.Any = js.native, once : Boolean = js.native) : Unit = js.native
  }
}
