import scala.scalajs.js
import scala.scalajs.js.annotation._
import scala.collection.mutable.{ArrayBuffer, Map => MutableMap}
import it.unibo.scafi.incarnations.BasicAbstractSpatialSimulationIncarnation
import it.unibo.scafi.config.GridSettings
import it.unibo.scafi.lib.StandardLibrary
import it.unibo.scafi.space.Point2D
import it.unibo.utils.{Interop, Linearizable}
import scala.concurrent.duration._
import scala.util.Try

object ScafiRuntime extends BasicAbstractSpatialSimulationIncarnation with StandardLibrary {
  override type ID = Int
  override type P = Point2D
  override type CNAME = String
  override type EXECUTION = AggregateInterpreter
  implicit override val idBounded: Builtins.Bounded[ID] = Builtins.Bounded.of_i
  implicit override val linearID: Linearizable[Int] = new Linearizable[Int] {
    override def toNum(v: Int): Int = v
    override def fromNum(n: Int): Int = n
  }
  implicit override val interopID: Interop[Int] = new Interop[Int] {
    override def toString(data: Int): String = data.toString
    override def fromString(s: String): Int = s.toInt
  }
  implicit override val interopCNAME: Interop[String] = new Interop[String] {
    override def toString(data: String): String = data
    override def fromString(s: String): String = s
  }
  override def cnameFromString(s: String): String = s

  sealed trait RuntimeActuationData
  sealed trait RuntimeMovement extends RuntimeActuationData
  case class RuntimeAbsoluteMovement(x: Double, y: Double) extends RuntimeMovement
  case class RuntimeVectorMovement(dx: Double, dy: Double) extends RuntimeMovement

  sealed trait LedMode
  case object off extends LedMode
  case object on extends LedMode

  sealed trait LedGroup
  case class One(i: Int, j: Int) extends LedGroup
  case class Row(i: Int) extends LedGroup
  case class Column(i: Int) extends LedGroup
  case object Diagonal extends LedGroup
  case object AntiDiagonal extends LedGroup
  case object All extends LedGroup
  case class Combine(groups: Seq[LedGroup]) extends LedGroup

  case class RuntimeMatrix(dimension: Int, pixels: Map[(Int, Int), String]) {
    def withPixel(i: Int, j: Int, color: String): RuntimeMatrix = {
      if (i >= 0 && i < dimension && j >= 0 && j < dimension) copy(pixels = pixels + ((i, j) -> color))
      else this
    }

    def withPixels(entries: Seq[(Int, Int, String)]): RuntimeMatrix =
      entries.foldLeft(this) { case (matrix, (i, j, color)) => matrix.withPixel(i, j, color) }

    def withAll(color: String): RuntimeMatrix = copy(pixels = pixels.keys.map(_ -> color).toMap)

    def get(i: Int, j: Int): String = pixels.getOrElse((i, j), "#000000")
  }

  object RuntimeMatrix {
    def fill(dimension: Int, color: String): RuntimeMatrix = RuntimeMatrix(
      dimension,
      (0 until dimension).flatMap(i => (0 until dimension).map(j => (i, j) -> color)).toMap
    )
  }

  case class RuntimeMatrixOp(color: String, cells: LedGroup) extends RuntimeActuationData

  object RuntimeMatrixOp {
    def apply(action: RuntimeMatrixOp, matrix: RuntimeMatrix): RuntimeMatrix = action.cells match {
      case One(i, j) => matrix.withPixel(i, j, action.color)
      case Column(i) => matrix.withPixels((0 until matrix.dimension).map(row => (row, i, action.color)))
      case Row(i) => matrix.withPixels((0 until matrix.dimension).map(column => (i, column, action.color)))
      case All => matrix.withAll(action.color)
      case Diagonal =>
        matrix.withPixels((0 until matrix.dimension).map(index => (index, index, action.color)))
      case AntiDiagonal =>
        matrix.withPixels((0 until matrix.dimension).map(index => (index, matrix.dimension - index - 1, action.color)))
      case Combine(groups) => groups.foldLeft(matrix) { case (current, group) => apply(action.copy(cells = group), current) }
    }
  }

  /**
   * Uniform-grid ("spatial hash") space: devices are bucketed into square cells whose side is
   * the communication radius, so a neighbourhood query only has to probe the 3x3 block of cells
   * around a device instead of scanning the whole network.
   *
   * Moving a device just marks the index dirty; the buckets are rebuilt lazily, at most once per
   * tick, by the first neighbourhood query that follows. That is what makes movement affordable:
   * the stock `Basic3DSpace` rescans every device on each `setLocation`, which is O(n^2) per tick
   * once every device moves, whereas one deferred rebuild is O(n + n*k).
   */
  class UniformGridSpace(initial: Map[ID, P], radius: Double) extends Space3D[ID](initial, radius) {
    private val positions: MutableMap[ID, P] = MutableMap.empty[ID, P] ++= initial
    private val cells: MutableMap[Long, ArrayBuffer[ID]] = MutableMap.empty
    private val nbrs: MutableMap[ID, ArrayBuffer[ID]] = MutableMap.empty
    private val cellSize: Double = if (radius > 0) radius else 1.0
    private val radiusSquared: Double = radius * radius
    private val noNeighbours: ArrayBuffer[ID] = ArrayBuffer.empty[ID]
    private var dirty: Boolean = true

    /** Cell coordinates packed into a single Long, so a bucket lookup allocates no tuple key. */
    private def cellKey(cx: Long, cy: Long): Long = (cx << 32) ^ (cy & 0xffffffffL)

    private def cellOf(value: Double): Long = Math.floor(value / cellSize).toLong

    private def withinRadius(a: P, b: P): Boolean = {
      val dx = a.x - b.x
      val dy = a.y - b.y
      val dz = a.z - b.z
      ((dx * dx) + (dy * dy) + (dz * dz)) <= radiusSquared
    }

    private def rebuild(): Unit = {
      cells.clear()
      nbrs.clear()
      positions.foreach { case (id, p) =>
        cells.getOrElseUpdate(cellKey(cellOf(p.x), cellOf(p.y)), ArrayBuffer.empty[ID]) += id
      }
      positions.foreach { case (id, p) =>
        val found = ArrayBuffer.empty[ID]
        // Probe by integer cell offset: stepping the coordinate by `cellSize` instead would
        // skip a bucket whenever the device sits exactly on a cell boundary.
        val cx = cellOf(p.x)
        val cy = cellOf(p.y)
        var dx = -1
        while (dx <= 1) {
          var dy = -1
          while (dy <= 1) {
            cells.get(cellKey(cx + dx, cy + dy)).foreach { bucket =>
              bucket.foreach { other =>
                if (other != id && withinRadius(p, positions(other))) found += other
              }
            }
            dy += 1
          }
          dx += 1
        }
        nbrs.update(id, found)
      }
      dirty = false
    }

    override def setLocation(e: ID, p: P): Unit = { positions.update(e, p); dirty = true }
    override def add(e: ID, p: P): Unit = { positions.update(e, p); dirty = true }
    override def remove(e: ID): Unit = { positions -= e; dirty = true }
    override def getLocation(e: ID): P = positions(e)
    override def getAll(): Iterable[ID] = positions.keys
    override def contains(e: ID): Boolean = positions.contains(e)
    override def getAt(p: P): Option[ID] = positions.collectFirst { case (id, q) if q == p => id }

    override def getNeighbors(e: ID): Iterable[ID] = {
      if (dirty) rebuild()
      nbrs.getOrElse(e, noNeighbours)
    }

    override def getNeighborsWithDistance(e: ID): Iterable[(ID, D)] = {
      val p = positions(e)
      getNeighbors(e).map(other => (other, p.distance(positions(other))))
    }
  }

  trait Actuation { self: AggregateProgram =>
    def rgb(r: Int, g: Int, b: Int): String = f"#$r%02x$g%02x$b%02x"

    def hsl(h: Double, s: Double, l: Double): String = {
      val hue = {
        val normalized = h % 1.0
        if (normalized < 0) normalized + 1.0 else normalized
      }
      val q = if (l < 0.5) l * (1 + s) else l + s - (l * s)
      val p = (2 * l) - q

      def hueToRgb(t0: Double): Double = {
        val t = if (t0 < 0) t0 + 1 else if (t0 > 1) t0 - 1 else t0
        if (t < 1.0 / 6.0) p + ((q - p) * 6 * t)
        else if (t < 0.5) q
        else if (t < 2.0 / 3.0) p + ((q - p) * (2.0 / 3.0 - t) * 6)
        else p
      }

      def toChannel(value: Double): Int = Math.max(0, Math.min(255, Math.round(value * 255).toInt))

      rgb(
        toChannel(hueToRgb(hue + (1.0 / 3.0))),
        toChannel(hueToRgb(hue)),
        toChannel(hueToRgb(hue - (1.0 / 3.0)))
      )
    }

    def hue(h: Double): String = hsl(h, 0.5, 0.5)

    case class LedSelect(cell: LedGroup) {
      def to(color: String): RuntimeMatrixOp = RuntimeMatrixOp(normalizeColor(color), cell)
      def to(mode: LedMode): RuntimeMatrixOp = RuntimeMatrixOp(mode match {
        case `off` => "#000000"
        case `on` => "#ffffff"
      }, cell)
    }

    def ledX: LedSelect = LedSelect(Combine(Seq(Diagonal, AntiDiagonal)))
    def ledO: LedSelect = LedSelect(All)
    def ledAll: LedSelect = LedSelect(All)
    def ledD: LedSelect = LedSelect(Diagonal)
    def ledAD: LedSelect = LedSelect(AntiDiagonal)
    def ledCol(i: Int): LedSelect = LedSelect(Column(i))
    def ledRow(i: Int): LedSelect = LedSelect(Row(i))
    def led(i: Int, j: Int): LedSelect = LedSelect(One(i, j))

    sealed trait VelocityComponent
    case class Polar(module: Double, angle: Double) extends VelocityComponent
    case class Cartesian(dx: Double, dy: Double) extends VelocityComponent

    object velocity {
      def set(polar: Polar): RuntimeMovement =
        RuntimeVectorMovement(polar.module * Math.sin(polar.angle), polar.module * Math.cos(polar.angle))

      def set(cartesian: Cartesian): RuntimeMovement = RuntimeVectorMovement(cartesian.dx, cartesian.dy)
    }

    object position {
      def set(position: (Double, Double)): RuntimeMovement = RuntimeAbsoluteMovement(position._1, position._2)
    }

    private def normalizeColor(color: String): String = color.toLowerCase match {
      case "white" => "#ffffff"
      case "red" => "#ff0000"
      case "green" => "#00ff00"
      case "blue" => "#0000ff"
      case "yellow" => "#ffff00"
      case "cyan" => "#00ffff"
      case "magenta" => "#ff00ff"
      case hex if hex.startsWith("#") => hex
      case other => other
    }
  }

  trait Movement2D { self: AggregateProgram with StandardSensors with Actuation =>
    type Velocity = Cartesian

    object Velocity {
      val Zero: Velocity = Cartesian(0, 0)
      def apply(x: Double, y: Double): Velocity = Cartesian(x, y)
    }

    implicit class RichVelocity(v: Velocity) {
      def +(other: Velocity): Velocity = Velocity(v.dx + other.dx, v.dy + other.dy)
      def -(other: Velocity): Velocity = Velocity(v.dx - other.dx, v.dy - other.dy)
      def unary_- : Velocity = Velocity(-v.dx, -v.dy)
      def *(alpha: Double): Velocity = Velocity(v.dx * alpha, v.dy * alpha)
      def /(alpha: Double): Velocity = if (alpha == 0) Velocity.Zero else Velocity(v.dx / alpha, v.dy / alpha)
      val module: Double = math.hypot(v.dx, v.dy)
      lazy val normalized: Velocity = if (module == 0) Velocity.Zero else v / module
    }

    sealed trait Zone
    case class CircularZone(center: (Double, Double), radius: Double) extends Zone
    case class RectangularZone(center: (Double, Double), width: Double, height: Double) extends Zone

    def clockwiseRotation(center: (Double, Double), speed: Double = 100): Velocity = {
      val current = currentPosition()
      Velocity(current.y - center._2, -(current.x - center._1)).normalized * speed
    }

    def clockwiseRotation(x: Double, y: Double, speed: Double): Velocity = clockwiseRotation((x, y), speed)

    def anticlockwiseRotation(center: (Double, Double), speed: Double = 100): Velocity = -clockwiseRotation(center, speed)

    def anticlockwiseRotation(x: Double, y: Double, speed: Double): Velocity = anticlockwiseRotation((x, y), speed)

    def goToPoint(dx: Double, dy: Double, speed: Double = 100): Velocity = {
      val current = currentPosition()
      Velocity(dx - current.x, dy - current.y).normalized * speed
    }

    def standStill: Velocity = Velocity.Zero

    def explore(zone: Zone, trajectoryTime: Int, reachGoalRange: Double = 0, speed: Double = 100): Velocity = {
      require(trajectoryTime > 0)
      val (_, _, velocity) = rep((randomCoordZone(zone), trajectoryTime, Velocity.Zero)) {
        case (goal, decay, currentVelocity) if decay == 0 => (randomCoordZone(zone), trajectoryTime, currentVelocity)
        case (goal, _, _) if goal.distance(currentPosition()) < reachGoalRange =>
          (goal, 0, goToPoint(goal.x, goal.y, speed))
        case (goal, decay, _) => (goal, decay - 1, goToPoint(goal.x, goal.y, speed))
      }
      velocity
    }

    private def randomCoordZone(zone: Zone): Point2D = zone match {
      case CircularZone((cx, cy), radius) =>
        Point2D(cx + (radius * positiveNegativeRandom()), cy + (radius * positiveNegativeRandom()))
      case RectangularZone((cx, cy), width, height) =>
        Point2D(cx + ((width / 2.0) * positiveNegativeRandom()), cy + ((height / 2.0) * positiveNegativeRandom()))
    }

    private def positiveNegativeRandom(): Double = {
      val sign = if (nextRandom() < 0.5) 1 else -1
      sign * nextRandom()
    }
  }
}

@JSExportTopLevel("scafiStandalone")
@JSExportAll
object ScafiStandalone {
  import ScafiRuntime._
  private val lId = linearID
  private var simulator: SpaceAwareSimulator = _
  private var userProgram: AggregateProgram = _
  private var lastTickTime: Double = 0L
  private val velocities: MutableMap[Int, (Double, Double)] = MutableMap.empty
  /** Actuations from the latest round, flattened once and shared by every consumer. */
  private val actuations: MutableMap[ID, Seq[RuntimeActuationData]] = MutableMap.empty
  /** Device ids as strings, indexed by id: `getState` needs one per node and two per edge. */
  private var idStrings: Array[String] = Array.empty
  private val sensorNames: StandardSensorNames = new StandardSensorNames {}

  trait RuntimeValueEncoder[-A] {
    def encode(value: A): js.Any
  }

  object RuntimeValueEncoder {
    def apply[A](encodeValue: A => js.Any): RuntimeValueEncoder[A] = new RuntimeValueEncoder[A] {
      override def encode(value: A): js.Any = encodeValue(value)
    }

    implicit val booleanEncoder: RuntimeValueEncoder[Boolean] = RuntimeValueEncoder(value => encodeValue(value))
    implicit val intEncoder: RuntimeValueEncoder[Int] = RuntimeValueEncoder(value => encodeValue(value))
    implicit val longEncoder: RuntimeValueEncoder[Long] = RuntimeValueEncoder(value => encodeValue(value.toDouble))
    implicit val doubleEncoder: RuntimeValueEncoder[Double] = RuntimeValueEncoder(value => encodeValue(value))
    implicit val stringEncoder: RuntimeValueEncoder[String] = RuntimeValueEncoder(value => encodeValue(value))
    implicit val jsAnyEncoder: RuntimeValueEncoder[js.Any] = RuntimeValueEncoder(value => value)
    implicit val matrixEncoder: RuntimeValueEncoder[RuntimeMatrix] = RuntimeValueEncoder(matrix => encodeMatrix(matrix))
  }

  trait RuntimeDeployment {
    def positionsFor(network: js.Dynamic, incoming: js.UndefOr[js.Any]): js.Dictionary[js.Any]
  }

  object RuntimeDeployment {
    def apply(
      generator: (js.Dynamic, js.UndefOr[js.Any]) => js.Dictionary[js.Any]
    ): RuntimeDeployment = new RuntimeDeployment {
      override def positionsFor(network: js.Dynamic, incoming: js.UndefOr[js.Any]): js.Dictionary[js.Any] =
        generator(network, incoming)
    }
  }

  private def cloneDictionary(source: js.Dictionary[js.Any]): js.Dictionary[js.Any] = {
    val cloned = js.Dictionary.empty[js.Any]
    source.foreach { case (key, value) => cloned.update(key, value) }
    cloned
  }

  def point(x: Double, y: Double): js.Dynamic = js.Dynamic.literal(x = x, y = y)

  private def cloneNestedDictionary(
    source: js.Dictionary[js.Dictionary[js.Any]]
  ): js.Dictionary[js.Dictionary[js.Any]] = {
    val cloned = js.Dictionary.empty[js.Dictionary[js.Any]]
    source.foreach { case (key, value) => cloned.update(key, cloneDictionary(value)) }
    cloned
  }

  private def encodeValue(value: Any): js.Any = value match {
    case value: Boolean => js.Dynamic.literal(kind = "boolean", value = value)
    case value: Int => js.Dynamic.literal(kind = "double", value = value.toDouble)
    case value: Long => js.Dynamic.literal(kind = "double", value = value.toDouble)
    case value: Double => js.Dynamic.literal(kind = "double", value = value)
    case value: String => js.Dynamic.literal(kind = "string", value = value)
    case other => js.Dynamic.literal(kind = "string", value = other.toString)
  }

  private def encodeMatrix(dimension: Int, pixels: Seq[(Int, Int, String)]): js.Dynamic = {
    val encodedPixels = js.Array[js.Any]()
    pixels.foreach { case (i, j, color) =>
      encodedPixels.push(js.Array(js.Array(i.asInstanceOf[js.Any], j.asInstanceOf[js.Any]), color.asInstanceOf[js.Any]))
    }
    js.Dynamic.literal(kind = "matrix", dimension = dimension, pixels = encodedPixels)
  }

  private def uniformPixels(dimension: Int, color: String): Seq[(Int, Int, String)] =
    (0 until dimension).flatMap(i => (0 until dimension).map(j => (i, j, color)))

  final case class WorldDocumentBuilder(
    network: js.UndefOr[js.Dynamic] = js.undefined,
    neighbourConfig: js.UndefOr[js.Dynamic] = js.undefined,
    sensors: js.Dictionary[js.Any] = js.Dictionary.empty[js.Any],
    initialValues: js.Dictionary[js.Dictionary[js.Any]] = js.Dictionary.empty[js.Dictionary[js.Any]],
    positionOverrides: js.Dictionary[js.Any] = js.Dictionary.empty[js.Any],
    positionDeployment: js.UndefOr[RuntimeDeployment] = js.undefined,
    seedConfig: js.UndefOr[js.Dynamic] = js.undefined,
    configTransforms: Seq[WorldDocumentBuilder => WorldDocumentBuilder] = Seq.empty,
  ) {
    def grid(rows: Int, cols: Int, stepX: Double, stepY: Double, tolerance: Double): WorldDocumentBuilder =
      copy(network = js.Dynamic.literal(kind = "grid", rows = rows, cols = cols, stepX = stepX, stepY = stepY, tolerance = tolerance))

    def random(min: Double, max: Double, howMany: Int): WorldDocumentBuilder =
      copy(network = js.Dynamic.literal(kind = "random", min = min, max = max, howMany = howMany))

    def networkConfig(config: js.Dynamic): WorldDocumentBuilder = copy(network = config)

    def neighbour(config: js.Dynamic): WorldDocumentBuilder = copy(neighbourConfig = config)

    def radius(range: Double): WorldDocumentBuilder = neighbour(js.Dynamic.literal(range = range))

    def matrix(dimension: Int, color: String): WorldDocumentBuilder =
      sensorEncoded("matrix", encodeMatrix(dimension, uniformPixels(dimension, color)))

    def matrixPixels(dimension: Int, pixels: Seq[(Int, Int, String)]): WorldDocumentBuilder =
      sensorEncoded("matrix", encodeMatrix(dimension, pixels))

    def sensor[A](name: String, value: A)(implicit encoder: RuntimeValueEncoder[A]): WorldDocumentBuilder =
      sensorEncoded(name, encoder.encode(value))

    def sensorEncoded(name: String, value: js.Any): WorldDocumentBuilder = {
      val nextSensors = cloneDictionary(sensors)
      nextSensors.update(name, value)
      copy(sensors = nextSensors)
    }

    def sensorsEncoded(entries: (String, js.Any)*): WorldDocumentBuilder =
      entries.foldLeft(this) { case (current, (name, value)) => current.sensorEncoded(name, value) }

    def randomSensor(name: String, min: Double, max: Double): WorldDocumentBuilder = {
      configure { builder =>
        val network = builder.network.getOrElse(
          js.Dynamic.literal(kind = "grid", rows = 10, cols = 10, stepX = 60.0, stepY = 60.0, tolerance = 10.0)
        )
        val kind = network.selectDynamic("kind").toString
        val howMany = if (kind == "grid") {
          asInt(network.selectDynamic("rows")) * asInt(network.selectDynamic("cols"))
        } else if (kind == "random") {
          asInt(network.selectDynamic("howMany"))
        } else {
          100
        }

        val seeds = builder.seedConfig.getOrElse(
          js.Dynamic.literal(configSeed = 0L, simulationSeed = 0L, randomSensorSeed = 0L)
        )
        val seed = asLong(seeds.selectDynamic("randomSensorSeed"))
        val rng = new scala.util.Random(seed ^ name.hashCode)

        val nextInitialValues = cloneNestedDictionary(builder.initialValues)
        for (i <- 1 to howMany) {
          val nodeId = i.toString
          val nodeDict = cloneDictionary(nextInitialValues.getOrElse(nodeId, js.Dictionary.empty[js.Any]))
          
          val randValue = min + (rng.nextDouble() * (max - min))
          
          if (!nodeDict.contains(name)) {
            nodeDict.update(name, encodeValue(randValue))
            nextInitialValues.update(nodeId, nodeDict)
          }
        }
        builder.copy(initialValues = nextInitialValues)
      }
    }

    def initial[A](nodeId: String, sensorName: String, value: A)(implicit encoder: RuntimeValueEncoder[A]): WorldDocumentBuilder =
      initialEncoded(nodeId, sensorName, encoder.encode(value))

    def initialEncoded(nodeId: String, sensorName: String, value: js.Any): WorldDocumentBuilder = {
      val nextInitialValues = cloneNestedDictionary(initialValues)
      val nodeValues = cloneDictionary(nextInitialValues.getOrElse(nodeId, js.Dictionary.empty[js.Any]))
      nodeValues.update(sensorName, value)
      nextInitialValues.update(nodeId, nodeValues)
      copy(initialValues = nextInitialValues)
    }

    def position(nodeId: String, x: Double, y: Double): WorldDocumentBuilder = {
      val nextPositions = cloneDictionary(positionOverrides)
      nextPositions.update(nodeId, point(x, y))
      copy(positionOverrides = nextPositions)
    }

    def position(nodeId: Int, x: Double, y: Double): WorldDocumentBuilder = position(nodeId.toString, x, y)

    def positions(entries: Seq[(String, (Double, Double))]): WorldDocumentBuilder =
      entries.foldLeft(this) { case (current, (nodeId, (x, y))) => current.position(nodeId, x, y) }

    def deploy(deployment: RuntimeDeployment): WorldDocumentBuilder = copy(positionDeployment = deployment)

    def seed(config: Long, simulation: Long, randomSensor: Long): WorldDocumentBuilder =
      seeds(js.Dynamic.literal(configSeed = config, simulationSeed = simulation, randomSensorSeed = randomSensor))

    def seeds(config: js.Dynamic): WorldDocumentBuilder = copy(seedConfig = config)

    def configure(update: WorldDocumentBuilder => WorldDocumentBuilder): WorldDocumentBuilder =
      copy(configTransforms = configTransforms :+ update)
  }

  private def runtimeWorldDocument: WorldDocumentBuilder = {
    val world = WorldDocumentBuilder()
// $$WORLD_DOCUMENT$$
  }

  def loadAndInit(): Unit = {
    dispose()
// $$USER_CODE$$
    userProgram = program
    val builder = runtimeWorldDocument.configTransforms.foldLeft(runtimeWorldDocument) {
      case (current, transform) => transform(current)
    }
    simulator = createSimulator(builder)
    applyPositions(simulator, builder)
    applySensors(builder)
    lastTickTime = System.currentTimeMillis().toDouble
    cacheIdStrings()
    simulator.devs.foreach { case (id, _) =>
      simulator.exec(userProgram)
    }
    collectActuations()
    handleMatrixOps()
    handleMovement(0.0)
  }

  def tick(): Unit = {
    if (simulator != null && userProgram != null) {
      val now = System.currentTimeMillis().toDouble
      val deltaSeconds = if (lastTickTime == 0L) 0.016 else {
        val raw = (now - lastTickTime) / 1000.0
        Math.min(raw, 1.0)
      }
      lastTickTime = now
      val allIds = simulator.devs.keySet
      simulator.chgSensorValue(sensorNames.LSNS_DELTA_TIME, allIds,
        FiniteDuration((deltaSeconds * 1000).toLong, MILLISECONDS))
      simulator.devs.foreach { case (id, dev) =>
        simulator.exec(userProgram)
      }
      collectActuations()
      handleMatrixOps()
      handleMovement(deltaSeconds)
    }
  }

  def setPosition(nodeId: String, x: Double, y: Double): Unit = {
    if (simulator != null) {
      val id = asInt(nodeId.asInstanceOf[js.Any])
      velocities.remove(id)
      updatePosition(id, Point2D(x, y))
    }
  }

  def setSensorValue(sensorName: String, nodeIds: js.Array[String], value: js.Any): Unit = {
    if (simulator != null && nodeIds.nonEmpty) {
      simulator.chgSensorValue(
        sensorName,
        nodeIds.map(id => asInt(id.asInstanceOf[js.Any])).toSet,
        decodeCommandValue(value)
      )
    }
  }

  def dispose(): Unit = {
    simulator = null
    userProgram = null
    lastTickTime = 0L
    velocities.clear()
    actuations.clear()
    idStrings = Array.empty
  }

  def getState(options: js.UndefOr[js.Dynamic] = js.undefined): js.Dynamic = {
    var excludeEdges = false
    var compact = false
    if (options.isDefined) {
      val opts = options.get
      if (!js.isUndefined(opts.excludeEdges)) {
        excludeEdges = opts.excludeEdges.asInstanceOf[Boolean]
      }
      if (!js.isUndefined(opts.compact)) {
        compact = opts.compact.asInstanceOf[Boolean]
      }
    }

    if (simulator == null) {
      val e = js.Dynamic.literal()
      if (compact) {
        e.compact = true
        e.nodes = js.Array[js.Any]()
        e.edges = js.Array[String]()
      } else {
        e.nodes = js.Array[js.Any]()
        e.edges = js.Array[js.Array[String]]()
      }
      e
    } else {
      val devs = simulator.devs
      val neighbours = if (excludeEdges) Map.empty[ID, Iterable[ID]] else simulator.getAllNeighbours()

      if (compact) {
        val nodes = js.Array[js.Any]()
        devs.foreach { case (id, dev) =>
          val position = simulator.space.getLocation(id)
          nodes.push(js.Array[js.Any](idString(id), position.x, position.y, buildLabels(id, dev)))
        }

        val edges = js.Array[String]()
        if (!excludeEdges) {
          neighbours.foreach { case (from, tos) =>
            tos.foreach { to =>
              if (from < to) {
                edges.push(idString(from))
                edges.push(idString(to))
              }
            }
          }
        }

        val result = js.Dynamic.literal()
        result.updateDynamic("compact")(true)
        result.updateDynamic("nodes")(nodes.asInstanceOf[js.Any])
        result.updateDynamic("edges")(edges.asInstanceOf[js.Any])
        result
      } else {
        val nodes = js.Array[js.Any]()
        val edges = js.Array[js.Array[String]]()
        devs.foreach { case (id, dev) =>
          val position = simulator.space.getLocation(id)
          val node = js.Dynamic.literal()
          node.updateDynamic("id")(idString(id))
          node.updateDynamic("x")(position.x)
          node.updateDynamic("y")(position.y)
          node.updateDynamic("labels")(buildLabels(id, dev))
          nodes.push(node.asInstanceOf[js.Any])
        }
        if (!excludeEdges) {
          neighbours.foreach { case (from, tos) =>
            tos.foreach { to =>
              if (from < to) {
                edges.push(js.Array(idString(from), idString(to)))
              }
            }
          }
        }
        val result = js.Dynamic.literal()
        result.updateDynamic("nodes")(nodes.asInstanceOf[js.Any])
        result.updateDynamic("edges")(edges.asInstanceOf[js.Any])
        result
      }
    }
  }

  /** Builds the JS label bag for one device: sensors, velocity, exported value and led state. */
  private def buildLabels(id: ID, dev: DevInfo): js.Dynamic = {
    val labels = js.Dynamic.literal()
    dev.lsns.foreach { case (name, value) =>
      labels.updateDynamic(name)(encodeSensorValue(value))
    }
    velocities.get(id).foreach { case (vx, vy) =>
      labels.updateDynamic("vx")(vx)
      labels.updateDynamic("vy")(vy)
    }
    simulator.getExport(id).foreach { exported =>
      val displayed = displayExport(exported.root[scala.Any]())
      if (displayed != null) {
        labels.updateDynamic("export")(displayed)
      }
    }
    actuations.get(id).foreach { data =>
      data.collectFirst { case op: RuntimeMatrixOp if op.cells == All => op.color }
        .foreach(color => labels.updateDynamic("ledAll")(color))
    }
    labels
  }

  private def idString(id: ID): String =
    if (id >= 0 && id < idStrings.length) idStrings(id) else id.toString

  private def cacheIdStrings(): Unit = {
    val ids = simulator.devs.keys
    val highest = if (ids.isEmpty) -1 else ids.max
    idStrings = new Array[String](highest + 1)
    ids.foreach(id => idStrings(id) = id.toString)
  }

  /**
   * Builds a simulator backed by a [[UniformGridSpace]].
   *
   * `simulatorFactory.gridLike` can no longer be used, because it hardcodes `Basic3DSpace`
   * inside scafi-commons. The grid deployment below therefore reproduces exactly what it did -
   * the same `SpaceHelper.gridLocations` call with the same seed, and the same 1-based ids - so
   * that saved sessions keep the node numbering and layout they already have.
   */
  private def buildSimulator(
    points: Seq[Point2D],
    range: Double,
    seeds: Seeds,
    repr: NetworkSimulator => String
  ): SpaceAwareSimulator = {
    val devs: Map[ID, DevInfo] = points.zipWithIndex.map { case (point, index) =>
      val id = lId.fromNum(index + 1)
      (id, new DevInfo(id, point.asInstanceOf[P], Map.empty, sns => nbr => Map.empty))
    }.toMap
    val space = new UniformGridSpace(devs.map { case (id, dev) => (id, dev.pos) }, range)
    new SpaceAwareSimulator(space, devs, repr, seeds.simulationSeed, seeds.randomSensorSeed)
  }

  private def createSimulator(builder: WorldDocumentBuilder): SpaceAwareSimulator = {
    val network = builder.network.getOrElse(
      js.Dynamic.literal(kind = "grid", rows = 10, cols = 10, stepX = 60.0, stepY = 60.0, tolerance = 10.0)
    )
    val neighbour = builder.neighbourConfig.getOrElse(
      js.Dynamic.literal(range = 70.0)
    )
    val seeds = builder.seedConfig.getOrElse(
      js.Dynamic.literal(configSeed = 0L, simulationSeed = 0L, randomSensorSeed = 0L)
    )
    val simulationSeeds = Seeds(
      asLong(seeds.selectDynamic("configSeed")),
      asLong(seeds.selectDynamic("simulationSeed")),
      asLong(seeds.selectDynamic("randomSensorSeed"))
    )
    val range = asDouble(neighbour.selectDynamic("range"))

    def gridSimulator(settings: GridSettings): SpaceAwareSimulator = buildSimulator(
      it.unibo.scafi.space.SpaceHelper.gridLocations(settings, simulationSeeds.configSeed),
      range,
      simulationSeeds,
      SpaceAwareSimulator.gridRepr(settings.nrows)
    )

    val simulator = network.selectDynamic("kind").toString match {
      case "grid" =>
        gridSimulator(
          GridSettings(
            asInt(network.selectDynamic("cols")),
            asInt(network.selectDynamic("rows")),
            asDouble(network.selectDynamic("stepX")),
            asDouble(network.selectDynamic("stepY")),
            asDouble(network.selectDynamic("tolerance"))
          )
        )
      case "random" =>
        buildSimulator(
          it.unibo.scafi.space.SpaceHelper.randomLocations(
            it.unibo.scafi.config.SimpleRandomSettings(
              asDouble(network.selectDynamic("min")),
              asDouble(network.selectDynamic("max"))
            ),
            asInt(network.selectDynamic("howMany")),
            simulationSeeds.configSeed
          ),
          range,
          simulationSeeds,
          SpaceAwareSimulator.defaultRepr
        )
      case unsupported =>
        js.Dynamic.global.console.warn("[ScafiWeb] Unsupported standalone network kind: " + unsupported + ". Falling back to a 10x10 grid.")
        gridSimulator(GridSettings(10, 10, 60.0, 60.0, 0.0))
    }
    simulator
  }

  private def applySensors(builder: WorldDocumentBuilder): Unit = {
    builder.sensors.foreach { case (sensorName, value) =>
      simulator.addSensor(sensorName, decodeValue(value))
    }

    builder.initialValues.foreach { case (nodeId, nodeValues) =>
      nodeValues.foreach { case (sensorName, value) =>
        simulator.chgSensorValue(sensorName, Set(nodeId.toInt), decodeValue(value))
      }
    }
  }

  private def applyPositions(simulator: SpaceAwareSimulator, builder: WorldDocumentBuilder): Unit = {
    val network = builder.network.getOrElse(
      js.Dynamic.literal(kind = "grid", rows = 10, cols = 10, stepX = 60.0, stepY = 60.0, tolerance = 10.0)
    )
    val deployedPositions = builder.positionDeployment
      .getOrElse(RuntimeDeployment((_, _) => js.Dictionary.empty[js.Any]))
      .positionsFor(network, js.undefined)

    deployedPositions.foreach { case (nodeId, pointObj) =>
      val point = pointObj.asInstanceOf[js.Dynamic]
      updatePosition(
        asInt(nodeId.asInstanceOf[js.Any]),
        Point2D(asDouble(point.selectDynamic("x")), asDouble(point.selectDynamic("y")))
      )
    }

    builder.positionOverrides.foreach { case (nodeId, pointObj) =>
      val point = pointObj.asInstanceOf[js.Dynamic]
      updatePosition(
        asInt(nodeId.asInstanceOf[js.Any]),
        Point2D(asDouble(point.selectDynamic("x")), asDouble(point.selectDynamic("y")))
      )
    }
  }

  /**
   * Flattens every device's export tree exactly once per round. Matrix actuation, movement and
   * `getState` all need the same list, and walking the tree once per consumer meant three full
   * passes over the network per tick.
   */
  private def collectActuations(): Unit = {
    actuations.clear()
    simulator.devs.foreach { case (id, _) =>
      simulator.getExport(id).foreach { exported =>
        val data = flattenValues(exported.root[Any]()).collect { case actuation: RuntimeActuationData => actuation }
        if (data.nonEmpty) {
          actuations.update(id, data)
        }
      }
    }
  }

  private def handleMatrixOps(): Unit = {
    actuations.foreach { case (id, data) =>
      val ops = data.collect { case op: RuntimeMatrixOp => op }
      if (ops.nonEmpty) {
        val current = Try(simulator.localSensor[RuntimeMatrix]("matrix")(id)).getOrElse(RuntimeMatrix.fill(3, "#bb86fc"))
        val updated = ops.foldLeft(current) { case (matrix, op) => RuntimeMatrixOp(op, matrix) }
        simulator.chgSensorValue("matrix", Set(id), updated)
      }
    }
  }

  private def handleMovement(deltaSeconds: Double): Unit = {
    actuations.foreach { case (id, data) =>
      data.foreach {
        case movement: RuntimeMovement => act(id, movement, deltaSeconds)
        case _ =>
      }
    }
  }

  private def act(id: Int, movement: RuntimeMovement, deltaSeconds: Double): Unit = {
    val position = movement match {
      case RuntimeAbsoluteMovement(x, y) =>
        velocities.remove(id)
        Point2D(x, y)
      case RuntimeVectorMovement(dx, dy) =>
        val oldPosition = simulator.space.getLocation(id)
        velocities.update(id, (dx, dy))
        Point2D((dx * deltaSeconds) + oldPosition.x, (dy * deltaSeconds) + oldPosition.y)
    }
    updatePosition(id, position)
  }

  private def updatePosition(id: Int, position: Point2D): Unit = {
    if (simulator != null && simulator.devs.contains(id)) {
      simulator.devs(id).pos = position
      simulator.space.setLocation(id, position)
    }
  }

  private def flattenValues(value: Any): Seq[Any] = value match {
    case actuation: RuntimeActuationData => Seq(actuation)
    case values: Iterable[_] => values.toSeq.flatMap(flattenValues)
    case values: Product if values.getClass.getName.startsWith("scala.Tuple") => values.productIterator.toSeq.flatMap(flattenValues)
    case values: Product => Seq(values)
    case other => Seq(other)
  }

  private def decodeValue(value: js.Any): Any = {
    if (value == null || js.isUndefined(value)) {
      null
    } else {
      val encoded = value.asInstanceOf[js.Dynamic]
      val kindVal = encoded.selectDynamic("kind")
      if (kindVal == null || js.isUndefined(kindVal)) {
        value.asInstanceOf[Any] match {
          case number: Int => number.toDouble
          case other => other
        }
      } else {
        kindVal.toString match {
          case "boolean" => encoded.selectDynamic("value").asInstanceOf[Boolean]
          case "double" => asDouble(encoded.selectDynamic("value"))
          case "string" =>
            val strVal = encoded.selectDynamic("value")
            if (strVal == null || js.isUndefined(strVal)) "" else strVal.toString
          case "matrix" => decodeMatrix(encoded)
          case _ => null
        }
      }
    }
  }

  private def decodeCommandValue(value: js.Any): Any = {
    if (value == null || js.isUndefined(value)) {
      null
    } else {
      val encoded = value.asInstanceOf[js.Dynamic]
      val kind = encoded.selectDynamic("kind")
      if (kind != null && !js.isUndefined(kind)) {
        decodeValue(value)
      } else {
        value.asInstanceOf[Any] match {
          case number: Int => number.toDouble
          case other => other
        }
      }
    }
  }

  private def decodeMatrix(value: js.Dynamic): RuntimeMatrix = {
    val dimension = asInt(value.selectDynamic("dimension"))
    val pixels = value.selectDynamic("pixels").asInstanceOf[js.Array[js.Array[js.Any]]].map { pixel =>
      val coordinates = pixel(0).asInstanceOf[js.Array[js.Any]]
      val color = pixel(1)
      val colorStr = if (color == null || js.isUndefined(color)) "#000000" else color.toString
      (asInt(coordinates(0)), asInt(coordinates(1))) -> colorStr
    }.toMap
    RuntimeMatrix(dimension, pixels)
  }

  private def encodeSensorValue(value: Any): js.Any = value match {
    case matrix: RuntimeMatrix => encodeMatrix(matrix)
    case value: Boolean => value.asInstanceOf[js.Any]
    case value: Int => value.asInstanceOf[js.Any]
    case value: Double => value.asInstanceOf[js.Any]
    case value: String => value.asInstanceOf[js.Any]
    case other => other.toString.asInstanceOf[js.Any]
  }

  private def encodeMatrix(matrix: RuntimeMatrix): js.Dynamic = {
    val encoded = js.Dynamic.literal()
    val pixels = js.Array[js.Any]()
    matrix.pixels.toSeq.sortBy { case ((i, j), _) => (i, j) }.foreach { case ((i, j), color) =>
      pixels.push(js.Array(js.Array(i.asInstanceOf[js.Any], j.asInstanceOf[js.Any]), color.asInstanceOf[js.Any]))
    }
    encoded.updateDynamic("dimension")(matrix.dimension)
    encoded.updateDynamic("pixels")(pixels)
    encoded
  }

  private def displayExport(value: Any): js.Any = value match {
    case _: RuntimeActuationData => null
    case value: Boolean => value.asInstanceOf[js.Any]
    case value: Int => value.asInstanceOf[js.Any]
    case value: Double => value.asInstanceOf[js.Any]
    case value: String => value.asInstanceOf[js.Any]
    case values: Iterable[_] => collapseDisplay(values.toSeq.map(displayExport).filter(_ != null))
    case values: Product => collapseDisplay(values.productIterator.toSeq.map(displayExport).filter(_ != null))
    case other => other.toString.asInstanceOf[js.Any]
  }

  private def collapseDisplay(values: Seq[js.Any]): js.Any = values match {
    case Seq() => null
    case Seq(single) => single
    case many => many.map(_.toString).mkString("(", ",", ")").asInstanceOf[js.Any]
  }

  private def asInt(value: js.Any): Int = {
    if (value == null || js.isUndefined(value)) {
      0
    } else {
      value.asInstanceOf[Any] match {
        case value: Int => value
        case value: Double => value.toInt
        case other =>
          val s = other.toString
          if (s == "undefined" || s == "null" || s.trim.isEmpty) 0 else s.toDouble.toInt
      }
    }
  }

  private def asLong(value: js.Any): Long = {
    if (value == null || js.isUndefined(value)) {
      0L
    } else {
      value.asInstanceOf[Any] match {
        case value: Double => value.toLong
        case value: Int => value.toLong
        case other =>
          val s = other.toString
          if (s == "undefined" || s == "null" || s.trim.isEmpty) 0L else s.toDouble.toLong
      }
    }
  }

  private def asDouble(value: js.Any): Double = {
    if (value == null || js.isUndefined(value)) {
      0.0
    } else {
      value.asInstanceOf[Any] match {
        case value: Double => value
        case value: Int => value.toDouble
        case other =>
          val s = other.toString
          if (s == "undefined" || s == "null" || s.trim.isEmpty) 0.0 else s.toDouble
      }
    }
  }
}
