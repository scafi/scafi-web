package it.unibo.scafi.js.view.dynamic
import it.unibo.scafi.js.model.{Graph, Node, Vertex}
import org.scalajs.dom
import org.scalajs.dom.html.Canvas

class CanvasGraphPane(canvas : Canvas) extends GraphPane {
  private val graphics = canvas.getContext("2d").asInstanceOf[dom.CanvasRenderingContext2D]
  private val nodeSize = 4
  override def render(graph: Graph): Unit = {
    graphics.clearRect(0, 0, canvas.width, canvas.height)
    graphics.fillStyle = "red"
    graphics.strokeStyle = "black"
    graph.nodes foreach drawNode
    graph.vertices foreach { vertex => drawVertex(vertex, graph) }
  }

  def drawNode(node : Node) : Unit = {
    import it.unibo.scafi.space.Point3D._
    val x = node.position.x
    val y = node.position.y
    graphics.fillRect(x, y, nodeSize, nodeSize)
    graphics.strokeText(node.id, x, y)
  }

  def drawVertex(vertex : Vertex, graph : Graph) : Unit = {
    val (from, to) = (graph(vertex.from), graph(vertex.to))
    graphics.beginPath()
    graphics.moveTo(from.position.x, from.position.y)
    graphics.moveTo(to.position.x, to.position.y)
    graphics.closePath()
  }
}
