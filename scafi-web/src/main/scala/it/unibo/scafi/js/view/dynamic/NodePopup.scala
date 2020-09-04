package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.{Debug, Utils}
import it.unibo.scafi.js.dsl.BasicWebIncarnation
import it.unibo.scafi.js.facade.phaser.Phaser.Scene
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.{Container, GameObject}
import it.unibo.scafi.js.facade.phaser.namespaces.gameobjects.ComponentsNamespace.Transform
import it.unibo.scafi.js.facade.simplebar.{SimpleBar, SimpleBarConfig}
import it.unibo.scafi.js.model.Node
import it.unibo.scafi.js.view.dynamic.PhaserGraphSection.ForceRepaint
import org.scalajs.dom.html.Div
import scalatags.JsDom.all.a

import scala.scalajs.js

class NodePopup(container: Container, scene : Scene) {
  import scalatags.JsDom.all._
  private var selected : Option[String] = None
  private val minBound = 200
  private val minHeight = 150
  def selectedId : Option[String] = selected

  def refresh(node: Node): Unit = {
    title.textContent = "node : " + node.id
    selected = Some(node.id)
    sensorList.innerHTML = ""
    exportList.innerHTML = ""
    val elements = node.labels.map {
      case (name, value : BasicWebIncarnation#EXPORT) => (name -> value.root[Any]().toString)
      case (name, value) => name -> value.toString
    }

    val treeView = node.labels.collect { case (name, value : BasicWebIncarnation#EXPORT) => value }
        .flatMap(value => value.paths.toSeq.sortBy(_._1.toString))
        .map { case (path, value) => li(cls := "list-group-item", s"$path -> $value" ).render}
        .foreach(exportList.appendChild)

    elements.map { case (name, value) => li(cls := "list-group-item", s"$name : $value" ).render }
        .foreach(sensorList.appendChild)
  }

  def focusOn(node : Transform with GameObject) : Unit = {
    gameElement.x = node.x
    gameElement.y = node.y
    gameElement.visible = true
    selected = Some(node.getData("id").toString)
    EventBus.publish(ForceRepaint)
  }
  private val closeButton = button(`type` := "button", cls := "close", span("×")).render
  private val title = h6(cls := "modal-tile").render
  private val sensorList = ul(cls :="list-group list-group-flush", style := "white-space : nowrap").render
  private val exportList = ul(cls :="list-group list-group-flush", style := "white-space : nowrap").render
  private val sensorDiv =  div(cls := "carousel-item active", sensorList).render
  private val exportDiv = div(cls := "carousel-item", exportList).render

  private val carouselInner = div(
    cls := "carousel-inner overflow-auto",
    style := s"height : ${minHeight}px",
    sensorDiv,
    exportDiv
  ).render

  private val carousel : Div = div(
    attr("data-interval") := "false",
    cls := "carousel slide",
    id := "carouselPopup",
    carouselInner
  ).render

  val html: Div = div(role := "dialog",
    div(
      width := minBound,
      cls := "modal-dialog", role := "document",
      div(
        cls := "modal-content",
        div(cls := "modal-header", title, closeButton),
        div(cls := "modal-body", carousel),
        div(
          cls := "modal-footer",
          a(cls := "carousel-control", href := "#carouselPopup", role := "button", attr("data-slide") := "prev",
            span( cls := "carousel-control-prev-icon")
          ),
          a(cls := "carousel-control",href := "#carouselPopup", role := "button", attr("data-slide") := "next",
            span( cls := "carousel-control-next-icon")
          )
        )
      )
    )
  ).render

  new SimpleBar(carouselInner)
  val gameElement = scene.add.dom(0,0,html)
  val domContainer = scene.add.container(0,0, js.Array(gameElement))
  container.add(domContainer)
  gameElement.visible = false
  closeButton.onclick = ev => {
    gameElement.visible = false
    selected = None
  }
}
