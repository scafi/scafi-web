package it.unibo.scafi.js.controller.local

object ScastieTemplate {
  def wrapCode(core: String): String =
    s"""import scala.scalajs.js
       |import scala.scalajs.js.annotation._
       |import it.unibo.scafi.incarnations.BasicAbstractSpatialSimulationIncarnation
       |import it.unibo.scafi.config.GridSettings
       |import it.unibo.scafi.lib.StandardLibrary
       |import it.unibo.scafi.space.Point2D
       |import it.unibo.utils.{Interop, Linearizable}
       |import scala.concurrent.duration.FiniteDuration
       |import scala.util.Try
       |
       |object ScafiRuntime extends BasicAbstractSpatialSimulationIncarnation with StandardLibrary {
       |  override type ID = Int
       |  override type P = Point2D
       |  override type CNAME = String
       |  override type EXECUTION = AggregateInterpreter
      |  implicit override val idBounded: Builtins.Bounded[ID] = Builtins.Bounded.of_i
       |  implicit override val linearID: Linearizable[Int] = new Linearizable[Int] {
       |    override def toNum(v: Int): Int = v
       |    override def fromNum(n: Int): Int = n
       |  }
       |  implicit override val interopID: Interop[Int] = new Interop[Int] {
       |    override def toString(data: Int): String = data.toString
       |    override def fromString(s: String): Int = s.toInt
       |  }
       |  implicit override val interopCNAME: Interop[String] = new Interop[String] {
       |    override def toString(data: String): String = data
       |    override def fromString(s: String): String = s
       |  }
       |  override def cnameFromString(s: String): String = s
       |
       |  sealed trait RuntimeActuationData
       |  sealed trait RuntimeMovement extends RuntimeActuationData
       |  case class RuntimeAbsoluteMovement(x: Double, y: Double) extends RuntimeMovement
       |  case class RuntimeVectorMovement(dx: Double, dy: Double) extends RuntimeMovement
       |
       |  sealed trait LedMode
       |  case object off extends LedMode
       |  case object on extends LedMode
       |
       |  sealed trait LedGroup
       |  case class One(i: Int, j: Int) extends LedGroup
       |  case class Row(i: Int) extends LedGroup
       |  case class Column(i: Int) extends LedGroup
       |  case object Diagonal extends LedGroup
       |  case object AntiDiagonal extends LedGroup
       |  case object All extends LedGroup
       |  case class Combine(groups: Seq[LedGroup]) extends LedGroup
       |
       |  case class RuntimeMatrix(dimension: Int, pixels: Map[(Int, Int), String]) {
       |    def withPixel(i: Int, j: Int, color: String): RuntimeMatrix = {
       |      if (i >= 0 && i < dimension && j >= 0 && j < dimension) copy(pixels = pixels + ((i, j) -> color))
       |      else this
       |    }
       |
       |    def withPixels(entries: Seq[(Int, Int, String)]): RuntimeMatrix =
       |      entries.foldLeft(this) { case (matrix, (i, j, color)) => matrix.withPixel(i, j, color) }
       |
       |    def withAll(color: String): RuntimeMatrix = copy(pixels = pixels.keys.map(_ -> color).toMap)
       |
       |    def get(i: Int, j: Int): String = pixels.getOrElse((i, j), "#000000")
       |  }
       |
       |  object RuntimeMatrix {
       |    def fill(dimension: Int, color: String): RuntimeMatrix = RuntimeMatrix(
       |      dimension,
       |      (0 until dimension).flatMap(i => (0 until dimension).map(j => (i, j) -> color)).toMap
       |    )
       |  }
       |
       |  case class RuntimeMatrixOp(color: String, cells: LedGroup) extends RuntimeActuationData
       |
       |  object RuntimeMatrixOp {
       |    def apply(action: RuntimeMatrixOp, matrix: RuntimeMatrix): RuntimeMatrix = action.cells match {
       |      case One(i, j) => matrix.withPixel(i, j, action.color)
       |      case Column(i) => matrix.withPixels((0 until matrix.dimension).map(row => (row, i, action.color)))
       |      case Row(i) => matrix.withPixels((0 until matrix.dimension).map(column => (i, column, action.color)))
       |      case All => matrix.withAll(action.color)
       |      case Diagonal =>
       |        matrix.withPixels((0 until matrix.dimension).map(index => (index, index, action.color)))
       |      case AntiDiagonal =>
       |        matrix.withPixels((0 until matrix.dimension).map(index => (index, matrix.dimension - index - 1, action.color)))
       |      case Combine(groups) => groups.foldLeft(matrix) { case (current, group) => apply(action.copy(cells = group), current) }
       |    }
       |  }
       |
       |  trait Actuation { self: AggregateProgram =>
       |    def rgb(r: Int, g: Int, b: Int): String = f"#$$r%02x$$g%02x$$b%02x"
       |
       |    def hsl(h: Double, s: Double, l: Double): String = {
       |      val hue = {
       |        val normalized = h % 1.0
       |        if (normalized < 0) normalized + 1.0 else normalized
       |      }
       |      val q = if (l < 0.5) l * (1 + s) else l + s - (l * s)
       |      val p = (2 * l) - q
       |
       |      def hueToRgb(t0: Double): Double = {
       |        val t = if (t0 < 0) t0 + 1 else if (t0 > 1) t0 - 1 else t0
       |        if (t < 1.0 / 6.0) p + ((q - p) * 6 * t)
       |        else if (t < 0.5) q
       |        else if (t < 2.0 / 3.0) p + ((q - p) * (2.0 / 3.0 - t) * 6)
       |        else p
       |      }
       |
       |      def toChannel(value: Double): Int = Math.max(0, Math.min(255, Math.round(value * 255).toInt))
       |
       |      rgb(
       |        toChannel(hueToRgb(hue + (1.0 / 3.0))),
       |        toChannel(hueToRgb(hue)),
       |        toChannel(hueToRgb(hue - (1.0 / 3.0)))
       |      )
       |    }
       |
       |    def hue(h: Double): String = hsl(h, 0.5, 0.5)
       |
       |    case class LedSelect(cell: LedGroup) {
       |      def to(color: String): RuntimeMatrixOp = RuntimeMatrixOp(normalizeColor(color), cell)
       |      def to(mode: LedMode): RuntimeMatrixOp = RuntimeMatrixOp(mode match {
      |        case `off` => "#000000"
      |        case `on` => "#ffffff"
       |      }, cell)
       |    }
       |
       |    def ledX: LedSelect = LedSelect(Combine(Seq(Diagonal, AntiDiagonal)))
       |    def ledO: LedSelect = LedSelect(All)
       |    def ledAll: LedSelect = LedSelect(All)
       |    def ledD: LedSelect = LedSelect(Diagonal)
       |    def ledAD: LedSelect = LedSelect(AntiDiagonal)
       |    def ledCol(i: Int): LedSelect = LedSelect(Column(i))
       |    def ledRow(i: Int): LedSelect = LedSelect(Row(i))
       |    def led(i: Int, j: Int): LedSelect = LedSelect(One(i, j))
       |
       |    sealed trait VelocityComponent
       |    case class Polar(module: Double, angle: Double) extends VelocityComponent
       |    case class Cartesian(dx: Double, dy: Double) extends VelocityComponent
       |
       |    object velocity {
       |      def set(polar: Polar): RuntimeMovement =
       |        RuntimeVectorMovement(polar.module * Math.sin(polar.angle), polar.module * Math.cos(polar.angle))
       |
       |      def set(cartesian: Cartesian): RuntimeMovement = RuntimeVectorMovement(cartesian.dx, cartesian.dy)
       |    }
       |
       |    object position {
       |      def set(position: (Double, Double)): RuntimeMovement = RuntimeAbsoluteMovement(position._1, position._2)
       |    }
       |
       |    private def normalizeColor(color: String): String = color.toLowerCase match {
       |      case "white" => "#ffffff"
       |      case "red" => "#ff0000"
       |      case "green" => "#00ff00"
       |      case "blue" => "#0000ff"
       |      case "yellow" => "#ffff00"
       |      case "cyan" => "#00ffff"
       |      case "magenta" => "#ff00ff"
       |      case hex if hex.startsWith("#") => hex
       |      case other => other
       |    }
       |  }
       |
       |  trait Movement2D { self: AggregateProgram with StandardSensors with Actuation =>
       |    type Velocity = Cartesian
       |
       |    object Velocity {
       |      val Zero: Velocity = Cartesian(0, 0)
       |      def apply(x: Double, y: Double): Velocity = Cartesian(x, y)
       |    }
       |
       |    implicit class RichVelocity(v: Velocity) {
       |      def +(other: Velocity): Velocity = Velocity(v.dx + other.dx, v.dy + other.dy)
       |      def -(other: Velocity): Velocity = Velocity(v.dx - other.dx, v.dy - other.dy)
       |      def unary_- : Velocity = Velocity(-v.dx, -v.dy)
       |      def *(alpha: Double): Velocity = Velocity(v.dx * alpha, v.dy * alpha)
       |      def /(alpha: Double): Velocity = if (alpha == 0) Velocity.Zero else Velocity(v.dx / alpha, v.dy / alpha)
       |      val module: Double = math.hypot(v.dx, v.dy)
       |      lazy val normalized: Velocity = if (module == 0) Velocity.Zero else v / module
       |    }
       |
       |    sealed trait Zone
       |    case class CircularZone(center: (Double, Double), radius: Double) extends Zone
       |    case class RectangularZone(center: (Double, Double), width: Double, height: Double) extends Zone
       |
       |    def clockwiseRotation(center: (Double, Double)): Velocity = {
       |      val current = currentPosition()
       |      Velocity(current.y - center._2, -(current.x - center._1)).normalized
       |    }
       |
       |    def clockwiseRotation(x: Double, y: Double): Velocity = clockwiseRotation((x, y))
       |
       |    def anticlockwiseRotation(center: (Double, Double)): Velocity = -clockwiseRotation(center)
       |
       |    def anticlockwiseRotation(x: Double, y: Double): Velocity = anticlockwiseRotation((x, y))
       |
       |    def goToPoint(dx: Double, dy: Double): Velocity = {
       |      val current = currentPosition()
       |      Velocity(dx - current.x, dy - current.y).normalized
       |    }
       |
       |    def standStill: Velocity = Velocity.Zero
       |
       |    def explore(zone: Zone, trajectoryTime: Int, reachGoalRange: Double = 0): Velocity = {
       |      require(trajectoryTime > 0)
       |      val (_, _, velocity) = rep((randomCoordZone(zone), trajectoryTime, Velocity.Zero)) {
       |        case (goal, decay, currentVelocity) if decay == 0 => (randomCoordZone(zone), trajectoryTime, currentVelocity)
       |        case (goal, _, _) if goal.distance(currentPosition()) < reachGoalRange =>
       |          (goal, 0, goToPoint(goal.x, goal.y))
       |        case (goal, decay, _) => (goal, decay - 1, goToPoint(goal.x, goal.y))
       |      }
       |      velocity
       |    }
       |
       |    private def randomCoordZone(zone: Zone): Point2D = zone match {
       |      case CircularZone((cx, cy), radius) =>
       |        Point2D(cx + (radius * positiveNegativeRandom()), cy + (radius * positiveNegativeRandom()))
       |      case RectangularZone((cx, cy), width, height) =>
       |        Point2D(cx + ((width / 2.0) * positiveNegativeRandom()), cy + ((height / 2.0) * positiveNegativeRandom()))
       |    }
       |
       |    private def positiveNegativeRandom(): Double = {
       |      val sign = if (nextRandom() < 0.5) 1 else -1
       |      sign * nextRandom()
       |    }
       |  }
       |}
       |
      |@JSExportTopLevel("scafiStandalone")
       |@JSExportAll
       |object ScafiStandalone {
       |  import ScafiRuntime._
       |  private var simulator: SpaceAwareSimulator = _
       |  private var userProgram: AggregateProgram = _
       |  private val sensorNames: StandardSensorNames = new StandardSensorNames {}
       |
       |  def loadAndInit(configJson: String): Unit = {
      |    dispose()
       |    $core
       |    userProgram = program
       |    val config = js.JSON.parse(configJson).asInstanceOf[js.Dynamic]
       |    simulator = createSimulator(config)
      |    applyPositions(simulator, config)
       |    applySensors(config)
       |  }
       |
       |  def tick(): Unit = {
       |    if (simulator != null && userProgram != null) {
       |      simulator.getAllNeighbours()
       |      simulator.devs.foreach { case (id, _) =>
       |        simulator.exec(userProgram)
       |      }
       |      handleMatrixOps()
       |      handleMovement()
       |    }
       |  }
       |
      |
      |  def setPosition(nodeId: String, x: Double, y: Double): Unit = {
      |    if (simulator != null) {
      |      updatePosition(asInt(nodeId.asInstanceOf[js.Any]), Point2D(x, y))
      |    }
      |  }
      |
      |  def setSensorValue(sensorName: String, nodeIds: js.Array[String], value: js.Any): Unit = {
      |    if (simulator != null && nodeIds.nonEmpty) {
      |      simulator.chgSensorValue(
      |        sensorName,
      |        nodeIds.map(id => asInt(id.asInstanceOf[js.Any])).toSet,
      |        decodeCommandValue(value)
      |      )
      |    }
      |  }
      |
      |  def dispose(): Unit = {
      |    simulator = null
      |    userProgram = null
      |  }
       |  def getState(): js.Dynamic = {
       |    if (simulator == null) {
       |      val e = js.Dynamic.literal()
       |      e.nodes = js.Array[js.Any]()
       |      e.edges = js.Array[js.Array[String]]()
       |      e
       |    } else {
       |      val exports = simulator.exports()
       |      val devs = simulator.devs
       |      val neighbours = simulator.getAllNeighbours()
       |      val nodes = js.Array[js.Any]()
       |      val edges = js.Array[js.Array[String]]()
       |      devs.foreach { case (id, dev) =>
      |        val position = simulator.space.getLocation(id)
       |        val node = js.Dynamic.literal()
      |        val labels = js.Dynamic.literal()
       |        node.updateDynamic("id")(id.toString)
      |        node.updateDynamic("x")(position.x)
      |        node.updateDynamic("y")(position.y)
      |        dev.lsns.foreach { case (name, value) =>
      |          labels.updateDynamic(name)(encodeSensorValue(value))
      |        }
      |        val expVal = exports.get(id).flatten.map(e => displayExport(e.root[scala.Any]())).orNull
      |        if (expVal != null) {
      |          labels.updateDynamic("export")(expVal)
      |        }
      |        node.updateDynamic("labels")(labels)
       |        nodes.push(node.asInstanceOf[js.Any])
       |      }
       |      neighbours.foreach { case (from, tos) =>
       |        tos.foreach { to =>
       |          edges.push(js.Array(from.toString, to.toString))
       |        }
       |      }
       |      val result = js.Dynamic.literal()
       |      result.updateDynamic("nodes")(nodes.asInstanceOf[js.Any])
       |      result.updateDynamic("edges")(edges.asInstanceOf[js.Any])
       |      result
       |    }
       |  }
      |
      |  private def createSimulator(config: js.Dynamic): SpaceAwareSimulator = {
      |    val network = config.selectDynamic("network").asInstanceOf[js.Dynamic]
      |    val neighbour = config.selectDynamic("neighbour").asInstanceOf[js.Dynamic]
      |    val seeds = config.selectDynamic("seeds").asInstanceOf[js.Dynamic]
      |    val simulationSeeds = Seeds(
      |      asLong(seeds.selectDynamic("configSeed")),
      |      asLong(seeds.selectDynamic("simulationSeed")),
      |      asLong(seeds.selectDynamic("randomSensorSeed"))
      |    )
      |    val simulator = network.selectDynamic("kind").toString match {
      |      case "grid" =>
      |        simulatorFactory.gridLike(
      |          GridSettings(
      |            asInt(network.selectDynamic("cols")),
      |            asInt(network.selectDynamic("rows")),
      |            asDouble(network.selectDynamic("stepX")),
      |            asDouble(network.selectDynamic("stepY")),
      |            asDouble(network.selectDynamic("tolerance"))
      |          ),
      |          asDouble(neighbour.selectDynamic("range")),
      |          seeds = simulationSeeds
      |        ).asInstanceOf[SpaceAwareSimulator]
      |      case unsupported =>
      |        js.Dynamic.global.console.warn("[ScafiWeb] Unsupported standalone network kind: " + unsupported + ". Falling back to a 10x10 grid.")
      |        simulatorFactory.gridLike(
      |          GridSettings(10, 10, 60.0, 60.0, 0.0),
      |          asDouble(neighbour.selectDynamic("range")),
      |          seeds = simulationSeeds
      |        ).asInstanceOf[SpaceAwareSimulator]
      |    }
      |    simulator
      |  }
      |
      |  private def applySensors(config: js.Dynamic): Unit = {
      |    val sensors = config.selectDynamic("sensors").asInstanceOf[js.Dynamic]
      |    keys(sensors).foreach { sensorName =>
      |      simulator.addSensor(sensorName, decodeValue(sensors.selectDynamic(sensorName)))
      |    }
      |
      |    val initialValues = config.selectDynamic("initialValues")
      |    if (initialValues != null && !js.isUndefined(initialValues)) {
      |      val overrides = initialValues.asInstanceOf[js.Dynamic]
      |      keys(overrides).foreach { nodeId =>
      |        val nodeValues = overrides.selectDynamic(nodeId).asInstanceOf[js.Dynamic]
      |        keys(nodeValues).foreach { sensorName =>
      |          simulator.chgSensorValue(sensorName, Set(nodeId.toInt), decodeValue(nodeValues.selectDynamic(sensorName)))
      |        }
      |      }
      |    }
      |  }
      |
      |  private def applyPositions(simulator: SpaceAwareSimulator, config: js.Dynamic): Unit = {
      |    val positions = config.selectDynamic("positions")
      |    if (positions != null && !js.isUndefined(positions)) {
      |      val overrides = positions.asInstanceOf[js.Dynamic]
      |      keys(overrides).foreach { nodeId =>
      |        val point = overrides.selectDynamic(nodeId).asInstanceOf[js.Dynamic]
      |        updatePosition(
      |          asInt(nodeId.asInstanceOf[js.Any]),
      |          Point2D(asDouble(point.selectDynamic("x")), asDouble(point.selectDynamic("y")))
      |        )
      |      }
      |    }
      |  }
      |
      |  private def handleMatrixOps(): Unit = {
      |    val updates = simulator.exports().flatMap { case (id, exported) =>
      |      exported.map(_.root[Any]()).map(flattenValues).map(_.collect { case action: RuntimeMatrixOp => action }).filter(_.nonEmpty).map {
      |        actions =>
      |          val current = Try(simulator.localSensor[RuntimeMatrix]("matrix")(id)).getOrElse(RuntimeMatrix.fill(3, "#bb86fc"))
      |          id -> actions.foldLeft(current) { case (matrix, action) => RuntimeMatrixOp(action, matrix) }
      |      }
      |    }
      |
      |    updates.foreach { case (id, matrix) => simulator.chgSensorValue("matrix", Set(id), matrix) }
      |  }
      |
      |  private def handleMovement(): Unit = {
      |    simulator.exports().foreach { case (id, exported) =>
      |      exported.map(_.root[Any]()).foreach { rootValue =>
      |        flattenValues(rootValue).collect { case movement: RuntimeMovement => movement }.foreach(act(id, _))
      |      }
      |    }
      |  }
      |
      |  private def act(id: Int, movement: RuntimeMovement): Unit = {
      |    val position = movement match {
      |      case RuntimeAbsoluteMovement(x, y) => Point2D(x, y)
      |      case RuntimeVectorMovement(dx, dy) =>
      |        val oldPosition = simulator.space.getLocation(id)
      |        val delta = simulator.context(id).sense[FiniteDuration](sensorNames.LSNS_DELTA_TIME).map(_.toMillis).getOrElse(50L)
      |        Point2D((dx * delta) + oldPosition.x, (dy * delta) + oldPosition.y)
      |    }
      |    updatePosition(id, position)
      |  }

      |  private def updatePosition(id: Int, position: Point2D): Unit = {
      |    if (simulator != null && simulator.devs.contains(id)) {
      |      simulator.devs(id).pos = position
      |      simulator.space.setLocation(id, position)
      |    }
      |  }
      |
      |  private def flattenValues(value: Any): Seq[Any] = value match {
      |    case actuation: RuntimeActuationData => Seq(actuation)
      |    case values: Iterable[_] => values.toSeq
      |    case values: Product => values.productIterator.toSeq
      |    case other => Seq(other)
      |  }
      |
      |  private def decodeValue(value: js.Any): Any = {
      |    val encoded = value.asInstanceOf[js.Dynamic]
      |    encoded.selectDynamic("kind").toString match {
      |      case "boolean" => encoded.selectDynamic("value").asInstanceOf[Boolean]
      |      case "double" => asDouble(encoded.selectDynamic("value"))
      |      case "string" => encoded.selectDynamic("value").toString
      |      case "matrix" => decodeMatrix(encoded)
      |      case _ => null
      |    }
      |  }
      |
      |  private def decodeCommandValue(value: js.Any): Any = {
      |    if (value == null || js.isUndefined(value)) {
      |      null
      |    } else {
      |      val encoded = value.asInstanceOf[js.Dynamic]
      |      val kind = encoded.selectDynamic("kind")
      |      if (kind != null && !js.isUndefined(kind)) {
      |        decodeValue(value)
      |      } else {
      |        value.asInstanceOf[Any] match {
      |          case number: Int => number.toDouble
      |          case other => other
      |        }
      |      }
      |    }
      |  }
      |
      |  private def decodeMatrix(value: js.Dynamic): RuntimeMatrix = {
      |    val dimension = asInt(value.selectDynamic("dimension"))
      |    val pixels = value.selectDynamic("pixels").asInstanceOf[js.Array[js.Array[js.Any]]].map { pixel =>
      |      val coordinates = pixel(0).asInstanceOf[js.Array[js.Any]]
      |      (asInt(coordinates(0)), asInt(coordinates(1))) -> pixel(1).toString
      |    }.toMap
      |    RuntimeMatrix(dimension, pixels)
      |  }
      |
      |  private def encodeSensorValue(value: Any): js.Any = value match {
      |    case matrix: RuntimeMatrix => encodeMatrix(matrix)
      |    case value: Boolean => value.asInstanceOf[js.Any]
      |    case value: Int => value.asInstanceOf[js.Any]
      |    case value: Double => value.asInstanceOf[js.Any]
      |    case value: String => value.asInstanceOf[js.Any]
      |    case other => other.toString.asInstanceOf[js.Any]
      |  }
      |
      |  private def encodeMatrix(matrix: RuntimeMatrix): js.Dynamic = {
      |    val encoded = js.Dynamic.literal()
      |    val pixels = js.Array[js.Any]()
      |    matrix.pixels.toSeq.sortBy { case ((i, j), _) => (i, j) }.foreach { case ((i, j), color) =>
      |      pixels.push(js.Array(js.Array(i.asInstanceOf[js.Any], j.asInstanceOf[js.Any]), color.asInstanceOf[js.Any]))
      |    }
      |    encoded.updateDynamic("dimension")(matrix.dimension)
      |    encoded.updateDynamic("pixels")(pixels)
      |    encoded
      |  }
      |
      |  private def displayExport(value: Any): js.Any = value match {
      |    case _: RuntimeActuationData => null
      |    case value: Boolean => value.asInstanceOf[js.Any]
      |    case value: Int => value.asInstanceOf[js.Any]
      |    case value: Double => value.asInstanceOf[js.Any]
      |    case value: String => value.asInstanceOf[js.Any]
      |    case values: Iterable[_] => collapseDisplay(values.toSeq.map(displayExport).filter(_ != null))
      |    case values: Product => collapseDisplay(values.productIterator.toSeq.map(displayExport).filter(_ != null))
      |    case other => other.toString.asInstanceOf[js.Any]
      |  }
      |
      |  private def collapseDisplay(values: Seq[js.Any]): js.Any = values match {
      |    case Seq() => null
      |    case Seq(single) => single
      |    case many => many.map(_.toString).mkString("(", ",", ")").asInstanceOf[js.Any]
      |  }
      |
      |  private def keys(value: js.Dynamic): Seq[String] =
      |    js.Object.keys(value.asInstanceOf[js.Object]).map(_.toString).toSeq
      |
      |  private def asInt(value: js.Any): Int = value.asInstanceOf[Any] match {
      |    case value: Int => value
      |    case value: Double => value.toInt
      |    case other => other.toString.toDouble.toInt
      |  }
      |
      |  private def asLong(value: js.Any): Long = value.asInstanceOf[Any] match {
      |    case value: Double => value.toLong
      |    case value: Int => value.toLong
      |    case other => other.toString.toDouble.toLong
      |  }
      |
      |  private def asDouble(value: js.Any): Double = value.asInstanceOf[Any] match {
      |    case value: Double => value
      |    case value: Int => value.toDouble
      |    case other => other.toString.toDouble
      |  }
       |}
       |""".stripMargin
}
