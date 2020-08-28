package it.unibo.scafi.js.view.dynamic

import it.unibo.scafi.js.controller.local.SimulationExecution.{Continuously, TickBased}
import it.unibo.scafi.js.controller.local.{SimulationExecution, SimulationExecutionPlatform}
import it.unibo.scafi.js.controller.scripting.Script
import it.unibo.scafi.js.facade.codemirror.Editor
import org.scalajs.dom.html.{Div, Input, Label}
import org.scalajs.dom.raw.HTMLElement
import scalatags.JsDom.all._

import scala.util.{Failure, Success}
object SimulationControlsSection {
  private val buttonClass =  cls := "btn btn-primary mr-1"
  private val loadButton = button("load", buttonClass).render
  private val startButton = button("start", buttonClass).render
  private val stopButton = button("stop", buttonClass).render
  private val (rangeBatch, labelBatch, valueBatch) = rangeWithLabel("batch", 1, 1000, 1)
  private val (rangeDelta, labelDelta, valueDelta) = rangeWithLabel("delta", 0, 1000, 0)
  private val tick = button("tick", buttonClass).render

  import scala.concurrent.ExecutionContext.Implicits.global
  def render(execution : SimulationExecutionPlatform, editor : Editor, controlDiv : Div) : Unit = {
    var simulation : Option[SimulationExecution] = None

    (loadButton :: startButton :: stopButton :: tick :: Nil) foreach (el => controlDiv.appendChild(el))
    (labelBatch :: rangeBatch :: valueBatch :: labelDelta :: rangeDelta :: valueDelta :: Nil) foreach (el => controlDiv.appendChild(el))
    (tick :: stopButton :: startButton :: Nil) foreach {el => el.disabled = true }

    loadButton.onclick = event => execution.loadScript(Script.javascript(editor.getValue())).onComplete {
      case Success(ticker : TickBased) =>
        simulation foreach clearSimulationExecution
        simulation = Some(ticker)
        (tick :: startButton :: Nil) foreach { el => el.disabled = false }
      case Failure(exception) => //TODO
    }

    tick.onclick = _ => simulation match {
      case Some(ticker: TickBased) => ticker.withBatchSize(rangeBatch.intValue).tick()
      case _ =>
    }

    startButton.onclick = _ => simulation match {
      case Some(ticker : TickBased) => simulation = Some(ticker.toContinuously(rangeDelta.intValue, rangeBatch.intValue))
        stopButton.disabled = false
        (tick :: startButton :: loadButton :: Nil) foreach { el => el.disabled = true }
        (rangeBatch :: rangeDelta :: Nil) foreach { el => el.disabled = true }
    }

    stopButton.onclick = _ => simulation match {
      case Some(continuously: Continuously) => simulation = Some(continuously.stop().withBatchSize(rangeBatch.intValue))
        stopButton.disabled = true
        (tick :: startButton :: loadButton :: Nil) foreach { el => el.disabled = false }
        (rangeBatch :: rangeDelta :: Nil) foreach { el => el.disabled = false }

    }
  }

  private def clearSimulationExecution(execution : SimulationExecution) = execution match {
    case ex : Continuously => ex.stop()
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
