package it.unibo.scafi.js.utils

import it.unibo.scafi.space.Point3D

import scala.scalajs.js.annotation.{JSExportAll, JSExportTopLevel}

object SpaceAdapter {
  @JSExportTopLevel("Point3D")
  @JSExportAll
  case class JSPoint3D(override val x : Double, override val y : Double, override val z : Double) extends Point3D(x, y, z)

  @JSExportTopLevel("Point2D")
  @JSExportAll
  case class JSPoint2D(override val x : Double, override val y : Double, override val z : Double) extends Point3D(x, y, z)

}
