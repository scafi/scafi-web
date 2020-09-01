package it.unibo.scafi.js

import it.unibo.scafi.js.dsl.WebIncarnation
import org.scalatest.{BeforeAndAfterEach, Suite}

trait NetworkSupport extends BeforeAndAfterEach {
  self: Suite =>

  protected var webEngine : WebIncarnation.NETWORK = _

  override def beforeEach(): Unit = webEngine = WebIncarnationUtils.network()
}
