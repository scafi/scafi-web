package it.unibo.scafi.js.facade.simplebar

import it.unibo.scafi.js.CleanableObject
import org.scalajs.dom

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSImport, JSName}

@js.native
@JSImport("simplebar", JSImport.Default)
class SimpleBar(element : dom.Element, config : SimpleBarConfig = new SimpleBarConfig()) extends js.Object {
  def recalculate() : Unit = js.native
}
import it.unibo.scafi.js.facade.simplebar.SimpleBarConfig._
class SimpleBarConfig(val autoHide : Boolean = false,
                      val scrollbarMinSize : Int = 25,
                      val scrollbarMaxSize : Int = 0,
                      val classNames : BarClassName = new BarClassName(),
                      forceVisible : Visible = Hide,
                      direction : Direction = RightToLeft,
                      val timeout : Int = 1000,
                      val clickOnTrack : Boolean = true,
                     ) extends CleanableObject {
  @JSName("forceVisible") val jsVisible = forceVisible.value
  @JSName("direction") val jsDirection = direction.value
}

object SimpleBarConfig {
  sealed abstract class Direction(val value : String)
  object RightToLeft extends Direction("rtl")
  object LeftToRight extends Direction("ltr")

  sealed abstract class Visible(val value : Any)
  object ForceX extends Visible("x")
  object ForceY extends Visible("y")
  object IsVisible extends Visible(true)
  object Hide extends Visible(false)

}

class BarClassName(content : String = "simplebar-content",
                  scrollContent : String = "simplebar-scroll-content",
                  scrollbar : String =  "simplebar-scrollbar",
                  track : String =  "simplebar-track"
                  ) extends CleanableObject

object SimpleBar {
  def wrap(content : dom.Element) : Unit = new SimpleBar(content)
}