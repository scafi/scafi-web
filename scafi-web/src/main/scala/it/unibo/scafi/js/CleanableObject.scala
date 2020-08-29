package it.unibo.scafi.js

import scala.scalajs.js

/**
  * helper class to clean undefined properties. By default scala put key with undefined value.
  * todo make a macro that does this job
  */
class CleanableObject extends js.Object {
  clean(this)
  def clean(obj : js.Object) : Unit = {
    js.Object.entries(obj)
      .filter(element => js.isUndefined(element._2))
      .foreach(element => js.special.delete(obj, element._1))
  }
}
