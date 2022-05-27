package it.unibo.scafi

import scala.scalajs.js.annotation.JSImport
import scala.scalajs.{js => jsLib}
package object js {
  @jsLib.native
  @JSImport("canvas", JSImport.Namespace)
  object Canvas extends jsLib.Object
  Canvas
}
