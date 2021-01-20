package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.SimulationExecution.{Daemon, TickBased}
import it.unibo.scafi.js.controller.local.{SimulationExecution, SimulationExecutionPlatform, SupportConfiguration}
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.controller.scripting.Script.ScaFi
import monix.execution.Scheduler
import org.scalajs.dom.ext.AjaxException
import org.scalajs.dom.html.{Button, Div, Input, Label}
import scalatags.JsDom.all._

import scala.util.{Failure, Success}

class SimulationControlsSection {
  import it.unibo.scafi.js.utils.Execution
  implicit val exc: Scheduler = Execution.timeoutBasedScheduler

  private val buttonClass = cls := "btn btn-primary ml-1 btn-sm"
  val loadButton: Button = button("load", buttonClass, id := "load-code").render
  val startButton: Button = button("start", buttonClass, id := "start-sim").render
  val stopButton: Button = button("stop", buttonClass, id := "stop-sim").render
  val (rangeBatch, labelBatch, valueBatch) = rangeWithLabel("batch", 1, 1000, 1)
  val (rangeDelta, labelDelta, valueDelta) = rangeWithLabel("period", 0, 1000, 0)
  val tick: Button = button("tick", buttonClass, id := "tick-button").render
  var simulation : Option[SimulationExecution] = None

  stopButton.onclick = _ => stopCurrentSimulation()

  startButton.onclick = _ => simulation match {
    case Some(ticker : TickBased) =>
      val daemon = ticker.toDaemon(rangeDelta.intValue, rangeBatch.intValue)
      daemon.failed.onComplete {
        case Failure(exc) =>
          ErrorModal.showError(exc.toString)
          stopButton.click()
        case _ =>
      }
      simulation = Some(daemon)
      stopButton.disabled = false
      (tick :: startButton :: Nil) foreach { el => el.disabled = true }
      (rangeBatch :: rangeDelta :: Nil) foreach { el => el.disabled = true }
  }

  tick.onclick = _ => simulation match {
    case Some(ticker: TickBased) => ticker.withBatchSize(rangeBatch.intValue).tick() onComplete {
      case Failure(exc) => ErrorModal.showError(exc.toString)
      case _ =>
    }
    case _ =>
  }
  //TODO move the execution far from here...
  def render(execution: SimulationExecutionPlatform,
             editor: EditorSection, controlDiv: Div): Unit = {
    lazy val loader = new Loader(controlDiv.parentElement)
    (loadButton :: startButton :: stopButton :: tick :: Nil) foreach (el => controlDiv.appendChild(el))
    (labelBatch :: rangeBatch :: valueBatch :: labelDelta :: rangeDelta :: valueDelta :: Nil) foreach (el => controlDiv.appendChild(el))
    (tick :: stopButton :: startButton :: Nil) foreach { el => el.disabled = true }
    EventBus.listen {
      case code@ScaFi(_) => loadScript(code)
      case config : SupportConfiguration => stopCurrentSimulation()
    }
    loadButton.onclick = event => loadScript(editor.getScript())

    def loadScript(script : Script) : Unit = {
      loader.load()
      execution.loadScript(script).onComplete(result => {
        loader.loaded()
        result match {
        case Success(ticker: TickBased) =>
          simulation foreach clearSimulationExecution
          simulation = Some(ticker)
         (tick :: startButton :: Nil) foreach { el => el.disabled = false }
        case Failure(e : AjaxException) if(e.xhr.status == 404) => ErrorModal.showError(s"Compilation service not found...")
        case Failure(e : AjaxException) => ErrorModal.showError(s"request error, code : ${e.xhr.status }\n${e.xhr.responseText}")
        case Failure(exception) => ErrorModal.showError(exception.toString)
      }})
    }
  }

  private def stopCurrentSimulation() : Unit = {
    simulation = simulation.map(clearSimulationExecution)
    stopButton.disabled = true
    (tick :: startButton :: loadButton :: Nil) foreach { el => el.disabled = false }
    (rangeBatch :: rangeDelta :: Nil) foreach { el => el.disabled = false }
  }

  private def clearSimulationExecution(execution: SimulationExecution) : SimulationExecution = execution match {
    case ex: Daemon => ex.stop().withBatchSize(rangeBatch.intValue)
    case a => a
  }

  private implicit class RichInput(input: Input) {
    def intValue: Int = input.value.toInt
  }

  private def rangeWithLabel(name: String, min: Int = 0, max: Int, value: Int = 0): (Input, Label, Label) = {
    val range = input(tpe := "range", cls := "mt-2", id := name).render
    range.min = min.toString
    range.max = max.toString
    range.value = value.toString
    val valueLabel = label(range.value, cls := "mr-3 ml-3 text-light", `for` := name).render
    range.oninput = _ => valueLabel.textContent = range.value
    (range, label(`for` := name, name, cls := "mr-3 ml-3 text-light").render, valueLabel)
  }
}
