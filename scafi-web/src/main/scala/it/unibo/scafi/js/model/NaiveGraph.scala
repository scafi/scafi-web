package it.unibo.scafi.js.model
//TODO think if it is necessary to throws or not an exception
case class NaiveGraph(nodes: Set[Node], vertices: Set[Vertex]) extends Graph {
  private lazy val internalMap = nodes.map(node => node.id -> node).toMap
  // require(vertices.forall(vertex => contains(vertex.from) && contains(vertex.to))) //TODO this safety check is very slow, think how to manage this
  private lazy val neighbourMap = vertices
    .map(vertex => vertex.from -> internalMap(vertex.to))
    .groupBy(_._1)
    .mapValues(value => value.map(_._2))
  override def contains(id: String): Boolean = internalMap.contains(id)

  override def apply(id: String): Node = internalMap(id)

  override def get(id: String): Option[Node] = internalMap.get(id)

  override def neighbours(id: String): Set[Node] = neighbourMap.getOrElse(id, Set())

  override def neighbours(node: Node): Set[Node] = neighbourMap.getOrElse(node.id, Set())
}
