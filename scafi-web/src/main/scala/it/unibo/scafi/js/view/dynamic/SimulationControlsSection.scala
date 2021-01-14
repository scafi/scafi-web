package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.SimulationExecution.{Daemon, TickBased}
import it.unibo.scafi.js.controller.local.{SimulationExecution, SimulationExecutionPlatform}
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.controller.scripting.Script.ScaFi
import org.scalajs.dom.ext.AjaxException
import org.scalajs.dom.html.{Div, Input, Label}
import scalatags.JsDom.all._

import scala.util.{Failure, Success}
class SimulationControlsSection {
  import it.unibo.scafi.js.utils.Execution
  implicit val exc = Execution.timeoutBasedScheduler

  private val buttonClass =  cls := "btn btn-primary ml-1 btn-sm"
  private val loadButton = button("load", buttonClass).render
  private val startButton = button("start", buttonClass).render
  private val stopButton = button("stop", buttonClass).render
  private val (rangeBatch, labelBatch, valueBatch) = rangeWithLabel("batch", 1, 1000, 1)
  private val (rangeDelta, labelDelta, valueDelta) = rangeWithLabel("period", 0, 1000, 0)
  private val tick = button("tick", buttonClass).render
  var simulation : Option[SimulationExecution] = None

  stopButton.onclick = _ => simulation match {
    case Some(daemon: Daemon) => simulation = Some(daemon.stop().withBatchSize(rangeBatch.intValue))
      stopButton.disabled = true
      (tick :: startButton :: loadButton :: Nil) foreach { el => el.disabled = false }
      (rangeBatch :: rangeDelta :: Nil) foreach { el => el.disabled = false }
  }

  startButton.onclick = _ => simulation match {
    case Some(ticker : TickBased) =>
      val daemon = ticker.toDaemon(rangeDelta.intValue, rangeBatch.intValue)
      daemon.failed.onComplete {
        case Failure(exc) =>
          ErrorModal.showError(exc.getMessage)
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
      case Failure(exc) => ErrorModal.showError(exc.getMessage)
      case _ =>
    }
    case _ =>
  }

  //TODO move the execution far from here...
  def render(execution : SimulationExecutionPlatform,
             editor : EditorSection, controlDiv : Div) : Unit = {
    lazy val loader = new Loader(controlDiv.parentElement)

    (loadButton :: startButton :: stopButton :: tick :: Nil) foreach (el => controlDiv.appendChild(el))
    (labelBatch :: rangeBatch :: valueBatch :: labelDelta :: rangeDelta :: valueDelta :: Nil) foreach (el => controlDiv.appendChild(el))
    (tick :: stopButton :: startButton :: Nil) foreach {el => el.disabled = true }
    EventBus.listen {
      case code @ ScaFi(_) => loadScript(code)
    }
    loadButton.onclick = event => loadScript(editor.getScript())

    def loadScript(script : Script) : Unit = {
      loader.load()
      execution.loadScript(script).onComplete(result => {
        loader.loaded()
        result match {
          case Success(ticker : TickBased) =>
            simulation foreach clearSimulationExecution
            simulation = Some(ticker)
            (tick :: startButton :: Nil) foreach { el => el.disabled = false }
          case Failure(e : AjaxException) if(e.xhr.status == 404) => ErrorModal.showError(s"Compilation service not found...")
          case Failure(e : AjaxException) => ErrorModal.showError(s"request error, code : ${e.xhr.status }\n${e.xhr.responseText}")
          case Failure(exception) => ErrorModal.showError(exception.toString)
        }
      })
    }
  }

  private def clearSimulationExecution(execution : SimulationExecution) = execution match {
    case ex : Daemon => ex.stop()
    case _ =>
  }

  private implicit class RichInput(input: Input) {
    def intValue : Int = input.value.toInt
  }

  private def rangeWithLabel(name : String, min : Int = 0, max : Int, value : Int = 0) : (Input, Label, Label) = {
    val range = input(tpe := "range", cls := "mt-2", id := name).render
    range.min = min.toString
    range.max = max.toString
    range.value = value.toString
    val valueLabel = label(range.value,cls := "mr-3 ml-3 text-light", `for` := name).render
    range.oninput = _ => valueLabel.textContent = range.value
    (range, label(`for` := name, name, cls := "mr-3 ml-3 text-light").render, valueLabel)
  }
}
