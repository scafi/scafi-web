package it.unibo.scafi.js.facade.phaser.namespaces

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobal
import scala.scalajs.js.{
  ThisFunction,
  ThisFunction0,
  ThisFunction1,
  ThisFunction2,
  ThisFunction3,
  ThisFunction4,
  ThisFunction5,
  ThisFunction6,
  |
}

/** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Events.html]] */
@js.native
@JSGlobal("Phaser.Events")
object EventsNamespace extends js.Object {
  type Handler0[Me] = ThisFunction0[Me, Unit]
  type Handler1[Me] = ThisFunction1[Me, _, Unit]
  type Handler2[Me] = ThisFunction2[Me, _, _, Unit]
  type Handler3[Me] = ThisFunction3[Me, _, _, _, Unit]
  type Handler4[Me] = ThisFunction4[Me, _, _, _, _, Unit]
  type Handler5[Me] = ThisFunction5[Me, _, _, _, _, _, Unit]

  /** @see See [[https://photonstorm.github.io/phaser3-docs/Phaser.Events.EventEmitter.html]] */
  @js.native
  trait EventEmitter extends js.Object {
    /* methods */
    def addListener(event: String, fn: ThisFunction, context: js.Any = js.native): Unit = js.native
    def destroy(): Unit = js.native
    def emit(event: String, args: js.Any = js.native): Boolean = js.native
    def eventNames(): js.Array[String] = js.native
    def listenerCounter(event: String): Int = js.native
    def listeners(event: String): js.Array[js.Function] = js.native
    def off(event: String, fn: ThisFunction = js.native, context: js.Any = js.native, once: Boolean = js.native): Unit =
      js.native
    def on(event: String, fn: ThisFunction, context: js.Any = js.native): Unit = js.native
    def once(event: String, fn: ThisFunction, context: js.Any = js.native): Unit = js.native
    def removeAllListeners(event: String): Unit = js.native
    def removeListener(
        event: String,
        fn: ThisFunction = js.native,
        context: js.Any = js.native,
        once: Boolean = js.native
    ): Unit = js.native
  }
}
