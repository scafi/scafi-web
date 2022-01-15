package it.unibo.scafi.js.view.dynamic.graph

import it.unibo.scafi.js.dsl.BasicWebIncarnation
import it.unibo.scafi.js.facade.phaser.Phaser.{Input, Scene}
import it.unibo.scafi.js.facade.phaser.namespaces.GameObjectsNamespace.{Container, GameObject}
import it.unibo.scafi.js.facade.phaser.namespaces.gameobjects.ComponentsNamespace.Transform
import it.unibo.scafi.js.model.Node
import it.unibo.scafi.js.view.dynamic.CarouselModal.{CarouselContent, CarouselItem, ContentList, ContentTree}
import it.unibo.scafi.js.view.dynamic.graph.PhaserGraphSection.ForceRepaint
import it.unibo.scafi.js.view.dynamic.{CarouselModal, PageBus}
import org.scalajs.dom.raw.MouseEvent
import NodeRepresentation._
import it.unibo.scafi.js.facade.phaser.namespaces.input.InputEventsNamespace.{DRAG, POINTER_DOWN}
import it.unibo.scafi.js.utils.{Debug, Tree}
import it.unibo.scafi.js.view.JQueryBootstrap.fromJquery
import org.querki.jquery.{$, JQuery}
import scalatags.JsDom.all.s

import scala.scalajs.js

trait NodeDescriptionPopup {
  type GameNode = Transform with GameObject
  def focusOn(node: GameNode): Unit
  def refresh(node: Node): Unit
  def selectedId: Option[String]
}

object NodeDescriptionPopup {
  def apply(container: Container, scene: Scene): NodeDescriptionPopup = new NodeDescriptionPopupImpl(container, scene)

  private class NodeDescriptionPopupImpl(container: Container, scene: Scene) extends NodeDescriptionPopup {
    type Path = BasicWebIncarnation#Path
    type Export = BasicWebIncarnation#EXPORT
    private val width = 200
    private val heigth = 150
    var selectedId: Option[String] = None
    private val sensorList = ContentList()
    private val exportTree = ContentTree()
    private val carouselContent = CarouselContent(CarouselItem(sensorList, true), CarouselItem(exportTree))
    private val modal = CarouselModal(carouselContent, width, heigth)
    modal.html.removeAttribute("class") // otherwise, it isn't visible in phase
    modal.html.setAttribute("width", width.toString) // otherwise doesn't work the horizontal scroll
    modal.modalDialog.style.maxWidth = "100vw"
    val gameElement = scene.add.dom(0, 0, modal.html)
    val domContainer = scene.add.container(0, 0, js.Array(gameElement))

    container.add(domContainer)
    gameElement.visible = false
    modal.onClose = () => {
      gameElement.visible = false
      selectedId = None
    }

    $(s"#${modal.carouselInnerId}").resizable(
      js.Dynamic.literal(
        "handleSelector" -> s"#${modal.resizeId}",
        "onDrag" -> this.onDragHandler
      )
    )

    def refresh(node: Node): Unit = {
      updateTitle("node : " + node.id)
      val sensorsContent = node.labels.map { case (name, value) => name -> LabelRender.normalizeValue(value) }.map {
        case (name, value) => s"$name : $value"
      }

      val exports = node.labels.collect { case (name, value: Export) => value }
        .flatMap(value => value.paths.toSeq)

      val exportsTreeMap = exports
        .filter(!_._1.isRoot)
        .map { case (path, value) => path.pull() -> (path, value) }
        .groupBy(_._1)
        .mapValues(paths => paths.map(_._2))

      val root = exports.find(_._1.isRoot)

      exportTree.refreshContents(buildTreeFrom(root, exportsTreeMap))
      sensorList.refreshContents(sensorsContent)
    }
    def focusOn(node: Transform with GameObject): Unit = {
      gameElement.x = node.x
      gameElement.y = node.y
      gameElement.visible = true
      selectedId = Some(node.id)
      PageBus.publish(ForceRepaint)
    }

    private def updateTitle(title: String) = modal.title.innerHTML = title

    lazy val onDragHandler = (e: Any, el: JQuery, newWidth: Double, newHeight: Double, opt: Any) => {
      el.width(if (newWidth < width) width else newWidth)
      el.height(if (newHeight < heigth) heigth else newHeight)
      false
    }

    private def buildTreeFrom(root: Option[(Path, Any)], map: Map[Path, Iterable[(Path, Any)]]): Tree[String, String] =
      root match {
        case Some(node) =>
          Tree
            .fromMap[Path, Any](node, map)
            .map[String, String] { case (k, v) => pathToString(k) -> v.toString }
        case None => Tree[String, String]("root", "no data", Seq.empty)
      }

    private def pathToString(path: Path): String = if (path.isRoot) {
      "P:/"
    } else {
      path.head.toString + "/"
    }
  }
}
