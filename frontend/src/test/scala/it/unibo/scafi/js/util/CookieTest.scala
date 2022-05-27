package it.unibo.scafi.js.util

import it.unibo.scafi.js.utils.Cookie
import org.scalajs.dom.document
import org.scalatest.funspec.AsyncFunSpec
import org.scalatest.matchers.should.Matchers

import java.util.concurrent.TimeUnit
import scala.concurrent.{Future, Promise}
import scala.concurrent.duration.FiniteDuration

class CookieTest extends AsyncFunSpec with Matchers {
  private val (entry, data) = ("key", "value")
  private val emptyEntry = "noKey"
  private val milliseconds = 1000
  private val duration = FiniteDuration(milliseconds, TimeUnit.MILLISECONDS)
  override implicit val executionContext = scala.concurrent.ExecutionContext.Implicits.global
  describe("Cookie") {
    it("should be stored in the page") {
      Cookie.store(entry, data)
      assert(Cookie.has(entry))
      assert(Cookie.get(entry).contains(data))
    }

    it("should be removed from the page") {
      Cookie.store(entry, data)
      Cookie.remove(entry)
      assert(!Cookie.has(entry))
      assert(Cookie.get(entry).isEmpty)
    }

    it("should returns only stored cookie") {
      Cookie.has(emptyEntry) shouldBe false
    }

    it("should be able to remove all cookies") {
      Cookie.clear()
      Cookie.all() shouldBe Map.empty
    }

    it("should returns all cookie in a map representation") {
      val cookies = Map("key1" -> "value1", "key2" -> "value2")
      cookies.foreach { case (k, d) => Cookie.store(k, d)}
      assert(Cookie.all() == cookies)
    }

    it("should store cookie with temporal limit") {
      Cookie.storeWithTemporalLimit(entry, data, duration)
      assert(Cookie.has(entry))
      wakeUpAfter((duration + duration).toMillis).map {
        _ => assert(!Cookie.has(entry))
      }
    }
  }
  //todo put in utils
  def wakeUpAfter(time : Long) : Future[Unit] = {
    val promise = Promise[Unit]()
    scalajs.js.timers.setTimeout(time)(promise.success({}))
    promise.future
  }
}
