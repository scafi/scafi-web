package it.unibo.scafi.js.model

case class Vec3(x: Double, y: Double, z: Double) {
  def distance(other: Vec3): Double = {
    val dx = x - other.x
    val dy = y - other.y
    val dz = z - other.z
    Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  def xy: (Double, Double) = (x, y)

  def to2D: Vec3 = Vec3(x, y, 0)
}

object Vec3 {
  val Zero: Vec3 = Vec3(0, 0, 0)

  def from2D(x: Double, y: Double): Vec3 = Vec3(x, y, 0)
}
