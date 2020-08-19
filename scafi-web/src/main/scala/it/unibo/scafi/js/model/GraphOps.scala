package it.unibo.scafi.js.model

/**
 * define a set of operations used to alter nodes inside a graph
 */
trait NodeOperation {
  /**
   * Remove the node selected from the graph. If the node isn't in the graph, return the
   * current graph
   */
  def removeNode(node : String) : Graph

  /**
   * Insert the node in the graph. If the node is already in the graph, this method return a new
   * version of graph with the new node.
   */
  def insertNode(node : Node) : Graph
}
/**
 * define a set of operations used to alter vertex inside a graph
 */
trait VertexOperation {
  /**
   * Remove the selected vertex from the graph. If it isn't in the graph, return current the current
   * version of the graph.
   */
  def unlink(vertex : Vertex) : Graph

  /**
   * Insert the vertex in the graph.
   */
  def link(vertex: Vertex) : Graph
}
trait NeighbourOperation {
  /**
   * alter the entirely neighbours of a node
   * @param node
   * @param neighbour
   * @return
   */
  def replaceNeighbours(node : Node, neighbour : Set[Node]) : Graph
}

object Implicits {
  implicit class RichGraph(graph: Graph) extends NodeOperation with VertexOperation with NeighbourOperation {
    override def removeNode(node: String): Graph = graph match {
      case g : NodeOperation => g.removeNode(node)
      case _ => NaiveGraph(graph.nodes.filter(_.id != node), graph.vertices)
    }

    override def insertNode(node: Node): Graph = graph match {
      case g : NodeOperation => g.insertNode(node)
      case _ => NaiveGraph(graph.nodes + node, graph.vertices)
    }

    override def unlink(vertex: Vertex): Graph = graph match {
      case g : VertexOperation => g.link(vertex)
      case _ => NaiveGraph(graph.nodes, graph.vertices - vertex)
    }
    override def link(vertex: Vertex): Graph = graph match {
      case g : VertexOperation => g.unlink(vertex)
      case _ => NaiveGraph(graph.nodes, graph.vertices + vertex)
    }

    override def replaceNeighbours(node: Node, neighbours: Set[Node]): Graph = graph match {
      case g : NeighbourOperation => g.replaceNeighbours(node, neighbours)
      case _ =>
        val oldNeighbours = graph.neighbours(node)
        val vertex = graph.vertices
        val toRemove = oldNeighbours.map(neighbour => Vertex(node.id, neighbour.id))
        val toAdd = neighbours.map(neighbour => Vertex(node.id, neighbour.id))
        NaiveGraph(graph.nodes, (vertex -- toRemove) ++ toAdd)
    }
  }
}