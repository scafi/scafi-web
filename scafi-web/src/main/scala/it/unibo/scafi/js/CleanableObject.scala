package it.unibo.scafi.js

import scala.scalajs.js

/**
  * helper class to clean undefined properties. By default scala put key with undefined value.
  * todo make a macro that does this job
  */
class CleanableObject extends js.Object {
  clean()
  def clean() : Unit = {
    js.Object.entries(this)
      .filter(element => js.isUndefined(element._2))
      .foreach(element => js.special.delete(this, element._1))
  }
}
