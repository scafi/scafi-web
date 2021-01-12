package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.facade.simplebar.SimpleBar
import it.unibo.scafi.js.view.HtmlRenderable
import it.unibo.scafi.js.view.dynamic.CarouselModal._
import it.unibo.scafi.js.view.dynamic.Modal.ZeroPaddingModal
import org.scalajs.dom.html.{Div, Element, LI, UList}
import scalatags.JsDom.all._

case class CarouselModal(carousel: CarouselContent) extends Modal {
  override val title = h6(cls := "modal-tile").render
  override val minBound = 200
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

  private val innerModal = ZeroPaddingModal(title, Seq(carouselSection), Seq(prevSlide.render, nextSlide.render), minBound)

  override lazy val html: Element = innerModal.html

  innerModal.onClose = (e => this.onClose(e))
  SimpleBar.wrap(carouselInner)

  override def body: Seq[Element] = innerModal.body

  override def footer: Seq[Element] = innerModal.footer
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

