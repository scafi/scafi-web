package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.facade.simplebar.SimpleBar
import it.unibo.scafi.js.utils.Tree
import it.unibo.scafi.js.view.HtmlRenderable
import it.unibo.scafi.js.view.dynamic.CarouselModal._
import it.unibo.scafi.js.view.dynamic.Modal.ZeroPaddingModal
import it.unibo.scafi.js.view.static.StringIcon
import org.scalajs.dom.html.{Div, Element, LI, UList}
import scalatags.JsDom.all._

case class CarouselModal(carousel: CarouselContent, minBound: Double, innerHeight: Int) extends Modal {
  override val title = h6(cls := "modal-tile").render
  val resizeId: String = modalId + "icon"
  val carouselId: String = "controls-modal"
  val carouselInnerId: String = "inner-carousel"
  private val carouselInner = div(
    cls := "carousel-inner overflow-auto",
    id := carouselInnerId,
    style := s"height : ${innerHeight}px",
    carousel.contents.map(_.html)
  ).render

  private lazy val resizableIcon: Div = div(
    id := resizeId
  ).render

  private val carouselSection: Div = div(
    attr("data-interval") := "false",
    cls := "carousel slide",
    id := carouselId,
    carouselInner,
    resizableIcon
  ).render

  resizableIcon.style = s"""cursor: nwse-resize;
    |touch-action: none;
    |height: 10px;
    |position: relative;
    |margin-right: 5px;
    |float: right;
    |background-repeat: no-repeat;
    |width: 20px;
    |background-image: ${StringIcon.verticalDivider}
    |""".stripMargin

  private val nextSlide = a(
    cls := "carousel-control",
    href := s"#$carouselId",
    role := "button",
    attr("data-slide") := "next",
    span(cls := "carousel-control-next-icon")
  )

  private val prevSlide = a(
    cls := "carousel-control",
    href := s"#$carouselId",
    role := "button",
    attr("data-slide") := "prev",
    span(cls := "carousel-control-prev-icon")
  )
  private val innerModal =
    ZeroPaddingModal(title, Seq(carouselSection), Seq(prevSlide.render, nextSlide.render), minBound)
  override lazy val modalDialog: Element = innerModal.modalDialog
  override lazy val html: Element = innerModal.html

  innerModal.onClose = () => this.onClose()
  SimpleBar.wrap(carouselInner)

  override def body: Seq[Element] = innerModal.body

  override def footer: Seq[Element] = innerModal.footer
}

object CarouselModal {
  case class CarouselContent(contents: CarouselItem*)

  case class CarouselItem(content: HtmlRenderable[Element], active: Boolean = false) extends HtmlRenderable[Div] {
    private def activeString: String = if (active) "active" else ""
    override def html: Div = div(cls := s"carousel-item $activeString", content.html).render
  }

  case class ContentList() extends HtmlRenderable[UList] {
    private val listContent = ul(cls := "list-group list-group-flush", style := "white-space : nowrap").render

    override def html: UList = listContent

    def refreshContents(content: Iterable[String]): Unit = {
      listContent.innerHTML = ""
      for (elem <- content.map(listItemFromString))
        listContent.appendChild(elem)
    }

    def listItemFromString(value: String): LI = li(cls := "list-group-item bg-secondary", value).render
  }

  case class ContentTree() extends HtmlRenderable[UList] {
    private val listContent = ul(cls := "tree-list", style := "white-space : nowrap").render
    override def html: UList = listContent

    def refreshContents(contents: Tree[String, String]): Unit = {
      listContent.innerHTML = ""
      append(contents, listContent)
    }

    private def append(node: Tree[String, String], ul: UList): Unit = {
      ul.appendChild(listItemFromString(s"${node.key} -> ${node.data}"))
      val childrenUl = node.children.map(child => child -> createUl())
      childrenUl.foreach { case (tree, ul) => append(tree, ul) }
      childrenUl.foreach { case (_, childUl) => ul.appendChild(childUl) }
    }
    def listItemFromString(value: String): LI = li(value).render

    private def createUl(): UList = ul(cls := "nested", style := "white-space : nowrap").render
  }
}
