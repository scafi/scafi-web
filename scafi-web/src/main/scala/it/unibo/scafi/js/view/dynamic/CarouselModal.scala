package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.facade.simplebar.SimpleBar
import it.unibo.scafi.js.view.HtmlRenderable
import org.scalajs.dom.html.{Div, Element, LI, UList}
import org.scalajs.dom.raw.MouseEvent
import scalatags.JsDom.all._
import CarouselModal._

case class CarouselModal(carousel: CarouselContent) extends HtmlRenderable[Element] {
  private val closeButton = button(`type` := "button", cls := "close", span("×")).render
  private val title = h6(cls := "modal-tile").render
  private val minBound = 200
  private val innerHeight = 150
  private val carouselInner = div(
    cls := "carousel-inner overflow-auto",
    style := s"height : ${innerHeight}px",
    carousel.contents.map(_.html)
  ).render
  private val carouselSection : Div = div(
    attr("data-interval") := "false",
    cls := "carousel slide",
    id := "carouselPopup",
    carouselInner
  ).render

  private val nextSlide = a(
    cls := "carousel-control",href := "#carouselPopup", role := "button", attr("data-slide") := "next",
    span( cls := "carousel-control-next-icon")
  )

  private val prevSlide = a(cls := "carousel-control", href := "#carouselPopup", role := "button", attr("data-slide") := "prev",
    span( cls := "carousel-control-prev-icon")
  )

  private val modal : Div = div(role := "dialog",
    div(
      width := minBound,
      cls := "modal-dialog", role := "document",
      div(
        cls := "modal-content",
        div(cls := "modal-header", title, closeButton),
        div(cls := "modal-body", style := "padding : 0 !important", carouselSection),
        div(cls := "modal-footer", style := "padding : 0 !important", prevSlide, nextSlide)
      )
    )
  ).render

  override lazy val html: Element = modal

  def updateTitle(value : String) : Unit = title.textContent = value

  var onClose : (MouseEvent) => _ = (ev : MouseEvent) => {}

  SimpleBar.wrap(carouselInner)

  closeButton.onclick = ev => onClose(ev)
}

object CarouselModal {
  case class CarouselContent(contents : CarouselItem *)

  case class CarouselItem(content : HtmlRenderable[Element], active : Boolean = false) extends HtmlRenderable[Div] {
    private def activeString : String = if(active) "active" else ""
    override def html: Div = div(cls := s"carousel-item ${activeString}", content.html).render
  }

  case class ContentList() extends HtmlRenderable[UList] {
    private val listContent = ul(cls :="list-group list-group-flush", style := "white-space : nowrap").render

    override def html: UList = listContent

    def refreshContents(content : Iterable[String]) : Unit = {
      listContent.innerHTML = ""
      for (elem <- content.map(listItemFromString)) {
        listContent.appendChild(elem)
      }
    }

    def listItemFromString(value : String) : LI = li(cls := "list-group-item", value).render
  }
}

