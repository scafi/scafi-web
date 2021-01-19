package it.unibo.scafi.js.code

object HighLevelExample {
  trait Heater {
    def temp : Double
    def turnOn : Unit
    def turnOff : Unit
  }
  case class FakeHeater(baseline : Double) extends Heater {
    private var _temp = baseline
    private var on : Boolean = false

    override def temp: Double = {
      _temp += (if(on) { 0.1 } else { -0.1 })
      _temp
    }
    def turnOn : Unit = on = true
    def turnOff : Unit = on = false
  }
  def apply() : ExampleGroup = ExampleGroup("High level", Seq(
    Example.create("Pattern SCR") {
      """//using StandardSensors, BlockG, BlockC, BlockS, StateManagement
        |trait Heater {
        |  def temp : Double
        |  def turnOn : Unit
        |  def turnOff : Unit
        |}
        |case class FakeHeater(baseline : Double) extends Heater {
        |  private var _temp = baseline
        |  private var on : Boolean = false
        |
        |  override def temp: Double = {
        |    _temp += (if(on) { 0.1 } else { -0.1 })
        |    _temp
        |  }
        |  def turnOn : Unit = on = true
        |  def turnOff : Unit = on = false
        |}
        |//aggregate code
        |val baseline = 20
        |val toCold = 12
        |val toHot = 25
        |val heater = remember(FakeHeater(baseline))
        |val area = 200
        |val leader = S(area, nbrRange)
        |val potential = distanceTo(leader, nbrRange)
        |val count = C[Double, Double](potential, _ + _, 1.0, 0.0)
        |val temperature = C[Double, Double](potential, _ + _, heater.temp, 0.0)
        |val avg = temperature / count
        |val action : Heater => String = if(avg < toCold) {
        |  	h => {
        |      h.turnOn
        |      "turn on"
        |    }
        |} else if (avg > toHot) {
        |	h => {
        |      h.turnOff
        |      "turn off"
        |    }
        |} else {
        |	h => "ok.."
        |}
        |val workerAction = broadcast(leader, action)
        |branch(leader) { "leader" } { action(heater) }
        |""".stripMargin
    },
  ))
}
