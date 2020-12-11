package it.unibo.scafi.simulation
import it.unibo.scafi.config.GridSettings
import it.unibo.scafi.incarnations.BasicSimulationIncarnation._
object Benchmark extends App {
  val radius = 100
  val simulator = simulatorFactory.gridLike(GridSettings(), radius)
  def time(program : AggregateProgram, times : Int) : Long = {
    val start = System.nanoTime()
    (0 to times) foreach { _ => simulator.exec(program) }
    System.nanoTime() - start
  }
  val repProgram = new AggregateProgram {
    override def main(): Any = rep(0)(_ + 1)
  }
  val nbrFoldProgram = new AggregateProgram {
    override def main(): Any = minHood(nbr(10))
  }
  println("PROGRAM BENCHMARK. 10000 iterations per program")
  val repTime = time(repProgram, 10000)
  val nbrFoldTime = time(nbrFoldProgram, 10000)
  //println(s"rep time : $repTime")
  (0 to 100) foreach {
    _ => println(s"${(time(nbrFoldProgram, 10000) / 1000000).toInt}")
  }
}
