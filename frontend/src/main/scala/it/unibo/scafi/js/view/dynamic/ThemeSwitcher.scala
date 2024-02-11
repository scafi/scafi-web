package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.utils.{exist, GlobalStore}
import monix.execution.CancelableFuture
import org.querki.jquery.$
import org.scalajs.dom.document
import org.scalajs.dom.html.Form
import scalatags.JsDom.all

import scala.scalajs.js

object ThemeSwitcher {
  import all._

  private val keyTheme = new GlobalStore.Key {
    override type Data = Theme
    override val value: String = "theme"
  }
  private val lightStyle = link(id := "light", rel := "stylesheet", href := "style/light.css").render

  private var theme: Theme = GlobalStore.get(keyTheme).getOrElse(Light)

  def onLight(action: => Unit): CancelableFuture[Unit] = GlobalStore.listen(keyTheme) {
    case theme if theme.value == Light.value => action
    case _ =>
  }

  def onDark(action: => Unit): CancelableFuture[Unit] = GlobalStore.listen(keyTheme) {
    case theme if theme.value == Dark.value => action
    case _ =>
  }

  def render(rightSideBar: Form): Unit = {
    val isLight = theme.value == Light.value
    val toggle = Toggle(
      "Dark / Light",
      isLight,
      _ => {
        theme = theme.switch
        install(theme)
      }
    )
    //toggle.html.classList.add("pr-2")
    //rightSideBar.insertBefore(toggle.html, rightSideBar.childNodes(0))
    install(theme)
  }

  private def install(theme: Theme): Unit = {
    GlobalStore.put(keyTheme)(theme)
    theme.value match {
      case Light.value if !exist(lightStyle.id) => document.head.appendChild(lightStyle)
      case Dark.value if exist(lightStyle.id) => $(s"#${lightStyle.id}").remove()
      case _ =>
    }
  }

  trait Theme extends js.Object {
    def value: String

    def switch: Theme
  }

  object Light extends Theme {
    override val value: String = "light"

    def switch: Theme = Dark
  }

  object Dark extends Theme {
    override val value: String = "dark"

    def switch: Theme = Light
  }
}
