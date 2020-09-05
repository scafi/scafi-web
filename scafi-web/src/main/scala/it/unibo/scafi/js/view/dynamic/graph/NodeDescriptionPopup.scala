package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.dsl.BasicWebIncarnation
import it.unibo.scafi.js.facade.phaser.Phaser.Scene
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.{Container, GameObject}
import it.unibo.scafi.js.facade.phaser.namespaces.gameobjects.ComponentsNamespace.Transform
import it.unibo.scafi.js.model.Node
import it.unibo.scafi.js.view.dynamic.CarouselModal.{CarouselContent, CarouselItem, ContentList}
import it.unibo.scafi.js.view.dynamic.graph.PhaserGraphSection.ForceRepaint
import it.unibo.scafi.js.view.dynamic.{CarouselModal, EventBus}
import org.scalajs.dom.raw.MouseEvent

import scala.scalajs.js


trait NodeDescriptionPopup {
  type GameNode = Transform with GameObject
  def focusOn(node : GameNode) : Unit
  def refresh(node : Node) : Unit
  def selectedId : Option[String]
}

object NodeDescriptionPopup {
  def apply(container: Container, scene : Scene) : NodeDescriptionPopup = new NodeDescriptionPopupImpl(container, scene)

  private class NodeDescriptionPopupImpl(container: Container, scene : Scene) extends NodeDescriptionPopup {
    var selectedId : Option[String] = None

    def refresh(node: Node): Unit = {
      modal.updateTitle("node : " + node.id)
      val sensorsContent = node.labels
        .map { case (name, value) => name -> LabelRender.normalizeValue(value) }
        .map { case (name, value) => s"$name : $value"}
      val exportsContent = node.labels.collect { case (name, value : BasicWebIncarnation#EXPORT) => value }
        .flatMap(value => value.paths.toSeq.sortBy(_._1.toString))
        .map { case (path, value) => s"${path.toString} -> $value"}

      sensorList.refreshContents(sensorsContent)
      exportList.refreshContents(exportsContent)
    }

    def focusOn(node : Transform with GameObject) : Unit = {
      gameElement.x = node.x
      gameElement.y = node.y
      gameElement.visible = true
      selectedId = Some(node.getData("id").toString)
      EventBus.publish(ForceRepaint)
    }

    private val sensorList = ContentList()
    private val exportList = ContentList()
    private val carouselContent = CarouselContent(CarouselItem(sensorList, true), CarouselItem(exportList))
    private val modal = CarouselModal(carouselContent)

    val gameElement = scene.add.dom(0,0,modal.html)
    val domContainer = scene.add.container(0,0, js.Array(gameElement))
    container.add(domContainer)
    gameElement.visible = false
    modal.onClose = (ev : MouseEvent) => {
      gameElement.visible = false
      ev.stopImmediatePropagation()
      selectedId = None
    }
  }
}

