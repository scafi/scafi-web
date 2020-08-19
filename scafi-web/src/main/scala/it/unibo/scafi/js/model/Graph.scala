package it.unibo.scafi.js.model

import it.unibo.scafi.space.Point3D

/**
 * A graph model used to represent an aggregate system.
 * Conceptually this data structure should be immutable.
 * This graph contains a set of nodes uniquely identified by an id. Each node has a set
 * of labels that decorate a node with some useful information (e.g. sensor value,...).
 * The graph has also a set of vertex that link nodes with each other.
 */
trait Graph {
  def contains(id : String) : Boolean
  def apply(id : String) : Node
  def get(id : String) : Option[Node]
  def nodes : Set[Node]
  def vertices : Set[Vertex]
  def neighbours(id : String) : Set[Node]
  def neighbours(node : Node) : Set[Node]
}

object Graph {
  implicit def tupleToVertex(tuple : (String, String)) : Vertex = Vertex(tuple._1, tuple._2)
}
case class Vertex(from : String, to : String)
//position is a first class element or could be ignored?
case class Node(id : String, position : Point3D, labels : Seq[Label] = Seq())
case class Label(name : String, value : Any)