package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.{SimulationExecution, SimulationExecutionPlatform, SupportConfiguration}
import it.unibo.scafi.js.controller.local.SimulationExecution.{Daemon, TickBased}
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.controller.scripting.Script.ScaFi
import it.unibo.scafi.js.utils.{Debug, GlobalStore}
import it.unibo.scafi.js.view.HtmlRenderable
import it.unibo.scafi.js.view.static.RootStyle.smallPrimaryBtnClass
import monix.execution.Scheduler
import org.querki.jquery.$
import org.scalajs.dom.ext.AjaxException
import org.scalajs.dom.html.{Button, Div, Element, Input, Label}
import scalatags.JsDom.all._

import scala.util.{Failure, Success}

class SimulationControlsSection {

  import it.unibo.scafi.js.utils.Execution

  implicit val exc: Scheduler = Execution.timeoutBasedScheduler

  private val buttonClass = cls := smallPrimaryBtnClass("ml-1")
  val loadButton: Button = button("load", buttonClass, id := "load-code").render
  val startButton: Button = button("start", buttonClass, id := "start-sim").render
  val stopButton: Button = button("stop", buttonClass, id := "stop-sim").render
  val (slow, normal, fast) = (2, 5, 20)
  private val velocitySelector = VelocitySelector(slow, normal, fast)
  val tick: Button = button("tick", buttonClass, id := "tick-button").render
  var simulation: Option[SimulationExecution] = None

  velocitySelector.onChangeRadio = () => {
    simulation = simulation match {
      case Some(d: Daemon) =>
        Some(d.stop().toDaemon(0, velocitySelector.batchSize))
      case Some(t: TickBased) => Some(t.withBatchSize(velocitySelector.batchSize))
      case other => other
    }
  }
  stopButton.onclick = _ => stopCurrentSimulation()

  startButton.onclick = _ =>
    simulation match {
      case Some(ticker: TickBased) =>
        val daemon = ticker.toDaemon(0, velocitySelector.batchSize)
        daemon.failed.onComplete {
          case Failure(exc) =>
            ErrorModal.showError(exc.toString)
            stopButton.click()
          case _ =>
        }
        simulation = Some(daemon)
        stopButton.disabled = false
        (tick :: startButton :: Nil) foreach { el => el.disabled = true }
    }

  tick.onclick = _ =>
    simulation match {
      case Some(ticker: TickBased) =>
        ticker.withBatchSize(velocitySelector.batchSize).tick() onComplete {
          case Failure(exc) => ErrorModal.showError(exc.toString)
          case _ =>
        }
      case _ =>
    }

  // TODO move the execution far from here...
  def render(execution: SimulationExecutionPlatform, editor: EditorSection, controlDiv: Div): Unit = {
    lazy val loader = new Loader(controlDiv.parentElement)
    (loadButton :: startButton :: stopButton :: tick :: velocitySelector.html :: Nil) foreach (el =>
      controlDiv.appendChild(el)
    )
    (tick :: stopButton :: startButton :: Nil) foreach { el => el.disabled = true }
    velocitySelector.init()
    PageBus.listen {
      case code @ ScaFi(_) => loadScript(code)
      case config: SupportConfiguration => stopCurrentSimulation()
    }
    loadButton.onclick = event => loadScript(editor.getScript())

    def loadScript(script: Script): Unit = {
      loader.load()
      execution
        .loadScript(script)
        .onComplete { result =>
          loader.loaded()
          result match {
            case Success(ticker: TickBased) =>
              simulation foreach clearSimulationExecution
              simulation = Some(ticker.withBatchSize(velocitySelector.batchSize))
              (tick :: startButton :: Nil) foreach { el => el.disabled = false }
            case Failure(e: AjaxException) if e.xhr.status == 404 =>
              ErrorModal.showError(s"Compilation service not found...")
            case Failure(e: AjaxException) =>
              ErrorModal.showError(s"request error, code : ${e.xhr.status}\n${e.xhr.responseText}")
            case Failure(exception) => ErrorModal.showError(exception.toString)
          }
        }
    }
  }

  private def stopCurrentSimulation(): Unit = {
    simulation = simulation.map(clearSimulationExecution)
    stopButton.disabled = true
    if (simulation.nonEmpty) {
      startButton.disabled = false
    }
    (tick :: loadButton :: Nil) foreach { el => el.disabled = false }
  }

  private def clearSimulationExecution(execution: SimulationExecution): SimulationExecution = execution match {
    case ex: Daemon => ex.stop().withBatchSize(velocitySelector.batchSize)
    case a => a
  }

  private case class VelocitySelector(slow: Int, normal: Int, fast: Int) extends HtmlRenderable[Element] {
    private val globalLabel = "velocitySelector"
    val active: String = GlobalStore.getOrElseUpdate(globalLabel, "slow")
    var onChangeRadio: () => Unit = () => {}
    var batchSize: Int = active match {
      case "slow" => slow
      case "normal" => normal
      case "fast" => fast
    }

    override val html: Element = label(
      "speed",
      cls := "ml-2 font-weight-bold text-white",
      div(
        cls := "ml-2 btn-group btn-group-toggle",
        attr("data-toggle") := "buttons",
        label(
          cls := s"btn btn-sm btn-secondary ${activeLabel("slow")}",
          input(tpe := "radio", name := "speed", id := "slow"),
          "Slow"
        ),
        label(
          cls := s"btn btn-sm btn-secondary ${activeLabel("normal")}",
          input(tpe := "radio", name := "speed", id := "normal"),
          "Normal"
        ),
        label(
          cls := s"btn btn-sm btn-secondary ${activeLabel("fast")}",
          input(tpe := "radio", name := "speed", id := "fast"),
          "Fast"
        )
      )
    ).render

    def init(): Unit = {
      addListener("slow", slow)
      addListener("normal", normal)
      addListener("fast", fast)
    }

    private def activeLabel(s: String): String = s match {
      case `active` => "active"
      case _ => ""
    }

    private def addListener(name: String, value: Int): Unit = {
      $(s"#$name").on(
        "change",
        () => {
          batchSize = value
          GlobalStore.put(globalLabel, name)
          onChangeRadio()
        }
      )
    }
  }
}
