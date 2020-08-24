package it.unibo.scafi.js.view.dynamic
import it.unibo.scafi.js.model.{Graph, Node, Vertex}
import org.scalajs.dom
import org.scalajs.dom.html.Canvas

import scala.scalajs.js

class CanvasGraphPane(canvas : Canvas) extends (Graph => Unit) {
  private val graphics = canvas.getContext("2d").asInstanceOf[dom.CanvasRenderingContext2D]
  private val nodeSize = 4
  canvas.width = 600
  canvas.height = 600
  override def apply(graph: Graph): Unit = {
    val init = js.Dynamic.global.performance.now()
    graphics.clearRect(0, 0, canvas.width, canvas.height)
    graphics.fillStyle = "red"
    graphics.strokeStyle = "white"
    graphics.lineWidth = 1
    graph.nodes foreach drawNode
    graphics.strokeStyle = "rgba(125, 125, 125, 0.1)"
    graph.vertices foreach { vertex => drawVertex(vertex, graph) }
    val end = js.Dynamic.global.performance.now()
    println("render time = " + (end - init))
  }

  def drawNode(node : Node) : Unit = {
    val x = node.position.x
    val y = node.position.y
    graphics.fillRect(x, y, nodeSize, nodeSize)
    graphics.strokeText(node.id, x, y)
    graphics.strokeText(node.labels.head.value.toString, x, y + 10)
  }

  def drawVertex(vertex : Vertex, graph : Graph) : Unit = {
    val (from, to) = (graph(vertex.from), graph(vertex.to))
    graphics.beginPath()
    graphics.moveTo(from.position.x, from.position.y)
    graphics.lineTo(to.position.x, to.position.y)
    graphics.closePath()
    graphics.stroke()
  }
}
