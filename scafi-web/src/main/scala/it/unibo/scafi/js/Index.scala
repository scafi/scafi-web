package it.unibo.scafi.js

import java.util.concurrent.TimeUnit

import it.unibo.scafi.config.GridSettings
import it.unibo.scafi.incarnations.BasicSimulationIncarnation._
import it.unibo.scafi.js.facade.codemirror.{CodeMirror, Editor, EditorConfiguration}
import it.unibo.scafi.js.model.{Graph, Label, NaiveGraph, Vertex, Node => ModelNode}
import it.unibo.scafi.js.view.dynamic.PhaserGraphPane
import it.unibo.scafi.js.view.static.SkeletonPage
import it.unibo.scafi.js.{WebIncarnation => web}
import it.unibo.scafi.space.Point3D
import monix.reactive.subjects.PublishSubject
import org.scalajs.dom
import org.scalajs.dom.raw.HTMLTextAreaElement

import scala.concurrent.duration.FiniteDuration
import scala.scalajs.js
import scala.scalajs.js.annotation.{JSExport, JSExportTopLevel}
import scala.scalajs.js.timers.{SetIntervalHandle, clearInterval, setInterval}
/**
  * from the main body, scala js produce a javascript file.
  * it is an example of a ScaFi simulation transcompilated in javascript.
  */

@JSExportTopLevel("Index")
object Index {
  import org.scalajs.dom._
  var codeMirror : Editor = _
  val subject : PublishSubject[Graph] = PublishSubject()
  var graphRep : Graph = _
  class FooProgram extends AggregateProgram with StandardSensors {
    override def main(): Any = rep(Double.PositiveInfinity){ case g =>
      mux(sense[Boolean]("source")){ 0.0 }{
        minHoodPlus { nbr(g) + nbrRange() }
      }
    }
  }

  def appendPar(targetNode: dom.Node, text: String): Unit = {
    val parNode = document.createElement("p")
    parNode.textContent = text
    targetNode.appendChild(parNode)
  }


  var handle: Option[SetIntervalHandle] = None
  var net: NETWORK = _
  var program: CONTEXT => EXPORT = _

  var spatialNet: web.SpaceAwareSimulator = _
  var spatialProgram: web.CONTEXT => web.EXPORT = _

  @JSExport
  def main(args: Array[String]): Unit = {
    println("Index.main !!!")

    configurePage()

    spatialSim()

    sigma()

    jnetworkx()
  }

  def spatialSim() = {

    val spatialSim = web.simulatorFactory.gridLike(
      GridSettings(stepx = 40, stepy = 40, tolerance = 20, nrows = 20, ncols = 20),
      rng = 60.0
    ).asInstanceOf[web.SpaceAwareSimulator]
    spatialSim.addSensor("source", false)
    spatialSim.chgSensorValue("source", Set("1", "55", "86"), true)

    val spatialGraph = NetUtils.graph()

    for((id,pos@Point3D(x,y,z)) <- spatialSim.space.elemPositions){
      spatialGraph.addNode(id, new js.Object {
        val position = (x,y,z)
      })
      for(nbr <- spatialSim.space.getNeighbors(id)){
        spatialGraph.addEdge(id,nbr)
      }
    }
    //jsnetworkx.Network.draw(spatialGraph, jsnetworkx.DrawOptions("#visualizationPane"))

    spatialNet = spatialSim

    /*
    val devsToPos: Map[Int, Point3D] = spatialSim.map(n => new Point3D(n.position.x, n.position.y, n.position.z)).toMap // Map id->position
    val net = new web.SpaceAwareSimulator(
      space = new Basic3DSpace(devsToPos,
        proximityThreshold = 50.0
      ),
      devs = devsToPos.map { case (d, p) => d -> new web.DevInfo(d, p,
        Map.empty,
        nsns => nbr => null)
      },
      simulationSeed = simulationSeed,
      randomSensorSeed = configurationSeed
    )

    network.setNeighbours(net.getAllNeighbours)
     */
  }

  def sigma() = {
    //val s: sigma.Sigma = sigma.Sigma("#sigmaDiv")
    // s.graph.addNode(new sigma.Node("1"))
  }

  def jnetworkx() = {
    //val nxDiv = appendCanvas(dom.document.getElementById("canvasContainer"), "netDiv")
    val g: jsnetworkx.Graph = jsnetworkx.Network.gnpRandomGraph(10,0.4)
    //jsnetworkx.Network.draw(g, jsnetworkx.DrawOptions("#netDiv"))
  }

  @JSExportTopLevel("loadNewProgram")
  def loadNewProgram(): Unit = {
    val programText = s"""var dsl = new ScafiDsl();
                      var f = () => { with(dsl){
                        var res = ${codeMirror.getValue()};
                        return res;
                      }; };
                      dsl.programExpression = f;
                      [dsl, f]
    """
    println(s"Evaluating: ${programText}")

    val programFunctionAndProgram = js.eval(programText).asInstanceOf[js.Array[Any]]
    val aggregateProgram = programFunctionAndProgram(0).asInstanceOf[ScafiDsl]
    val programFunction = programFunctionAndProgram(1).asInstanceOf[js.Function0[Any]]
    // TODO: use aggregateProgram for running simulation
    //program = aggregateProgram.asInstanceOf[CONTEXT => EXPORT]
    spatialProgram = aggregateProgram.asInstanceOf[web.CONTEXT => web.EXPORT]
  }

  @JSExportTopLevel("switchSimulation")
  def time() : js.Dynamic = js.Dynamic.global.performance.now()
  def switchSimulation(): Unit = {
    handle match {
      case Some(h) => { clearInterval(h); handle = None }
      case None => handle = Some(setInterval(0) {
        if(graphRep == null) {
          val exports = spatialNet.exports()
          val vertices = spatialNet.getAllNeighbours()
            .flatMap{ case (id, ids) => ids map {Vertex(id, _)}}
            .toSet
          val nodes = exports
            .map { case (id, export) => ModelNode(id, spatialNet.space.getLocation(id), Label("export", export.map(_.root[Any]()).getOrElse("")))}.toSet
          graphRep = NaiveGraph(nodes, vertices)
        } else {
          import it.unibo.scafi.js.model.GraphOps.Implicits._
          for (i <- 0 to 100) {
            val res = spatialNet.exec(spatialProgram)
            val (id, export) = res
            graphRep = graphRep.insertNode(ModelNode(id, spatialNet.space.getLocation(id), Label("export", export.root[Any]().toString)))
          }
        }
        println("tick")
        subject.onNext(graphRep)
      })
    }
  }

  @JSExportTopLevel("onSelectProgram")
  def onSelectProgram(): Unit = {
    val p = selectProgram.asInstanceOf[html.Input].value
    println(s"Selected ${p}")
    document.getElementById("editor").innerHTML = programs(p)
    loadNewProgram()
  }

  val programs = Map(
    "hello scafi" -> "\"hello scafi\"",
    "round counter" -> "rep(0, (k) => k+1)",
    "gradient" ->
      """
        | rep(Infinity, (d) => {
        |  return mux(sense("source"), 0.0,
        |    foldhoodPlus(() => Infinity, Math.min, () => nbr(() => d) + nbrvar("nbrRange"))
        |  )
        | })
        |""".stripMargin
  )

  var selectProgram: Element = _

  def configurePage(): Unit = {
    document.head.appendChild(SkeletonPage.renderedStyle.render)
    document.body.appendChild(SkeletonPage.content.render)
    val editor = document.getElementById("editor").asInstanceOf[HTMLTextAreaElement]
    codeMirror = CodeMirror.fromTextArea(editor, new EditorConfiguration("javascript", "null", true))
    codeMirror.setValue(programs("round counter"))
    codeMirror.save()
    loadNewProgram()

    switchSimulation()
    /*
    val visualizationPane = document.getElementById("visualizationPane")
    val simulationCanvas = canvas().render
    graphPane = new CanvasGraphPane(simulationCanvas)
    visualizationPane.appendChild(simulationCanvas)
    */
    val phaserRender = new PhaserGraphPane("visualizationPane")
    import monix.execution.Scheduler.Implicits.global
    subject.sample(FiniteDuration(1000, TimeUnit.MILLISECONDS)).foreach(phaserRender)
  }
}
