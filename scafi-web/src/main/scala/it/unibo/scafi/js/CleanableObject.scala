package it.unibo.scafi.js

import scala.scalajs.js

/**
 * Helper class to clean undefined properties. By default scala put key with undefined value.
 * todo make a macro that does this job
 */
class CleanableObject extends js.Object {
  def clean(): Unit = {
    js.Object.entries(this)
      .filter(element => js.isUndefined(element._2))
      .foreach(element => js.special.delete(this, element._1))
  }
}
