import { describe, expect, it } from "vitest";

import { wrapStandaloneRuntimeCode } from "./runtime-template";

describe("runtime-template", () => {
  it("injects the world document as a full Scala block before the user program", () => {
    const wrapped = wrapStandaloneRuntimeCode(
      "val program = new MyProgram",
      'val x = 30\nworld\n  .grid(rows = x, cols = x, stepX = 60, stepY = 60, tolerance = 10)\n  .radius(70)',
    );

    expect(wrapped).toContain("final case class WorldDocumentBuilder(");
    expect(wrapped).toContain("def runtimeWorldDocument: WorldDocumentBuilder = {");
    expect(wrapped).toContain("val world = WorldDocumentBuilder()");
    expect(wrapped).toContain("def mergeRuntimeConfig(configJson: String): js.Dynamic");
    expect(wrapped).toContain("val config = mergeRuntimeConfig(configJson)");
    expect(wrapped).toContain("applySensors(config)\n    lastTickTime = System.currentTimeMillis().toDouble\n    simulator.getAllNeighbours()\n    simulator.devs.foreach { case (id, _) =>");
    expect(wrapped).toContain("val x = 30");
    expect(wrapped).toContain("world\n      .grid(rows = x, cols = x, stepX = 60, stepY = 60, tolerance = 10)\n      .radius(70)");
    expect(wrapped).toContain("val program = new MyProgram");
    expect(wrapped).not.toContain("$$WORLD_DOCUMENT$$");
  });

  it("lets the compiled world override incoming sensors and initial values", () => {
    const wrapped = wrapStandaloneRuntimeCode("val program = new MyProgram", "world.sensor(\"source\", true)");

    expect(wrapped).toContain(
      'encoded.updateDynamic("sensors")(mergeEncoded(mergeEncoded(js.Dictionary.empty[js.Any], incoming.selectDynamic("sensors")), sensors).asInstanceOf[js.Any])',
    );
    expect(wrapped).toContain(
      'encoded.updateDynamic("initialValues")(mergeNestedEncoded(mergeNestedEncoded(js.Dictionary.empty[js.Dictionary[js.Any]], incoming.selectDynamic("initialValues")), initialValues).asInstanceOf[js.Any])',
    );
  });

  it("exposes generic deployment, sensor encoding and config hooks in the world DSL", () => {
    const wrapped = wrapStandaloneRuntimeCode(
      "val program = new MyProgram",
      `implicit val pairEncoder: RuntimeValueEncoder[(Int, Int)] = RuntimeValueEncoder[(Int, Int)](pair =>
  js.Dynamic.literal(kind = "pair", left = pair._1, right = pair._2)
)
world
  .deploy(RuntimeDeployment((network, incoming) => js.Dictionary("1" -> point(10, 20))))
  .sensor("pair", (1, 2))
  .configure(config => config.updateDynamic("deployment")(js.Dynamic.literal(kind = "manual")))`,
    );

    expect(wrapped).toContain("trait RuntimeValueEncoder[-A]");
    expect(wrapped).toContain("trait RuntimeDeployment");
    expect(wrapped).toContain("def sensorEncoded(name: String, value: js.Any): WorldDocumentBuilder");
    expect(wrapped).toContain("def randomSensor(name: String, min: Double, max: Double): WorldDocumentBuilder");
    expect(wrapped).toContain("def position(nodeId: String, x: Double, y: Double): WorldDocumentBuilder");
    expect(wrapped).toContain("def deploy(deployment: RuntimeDeployment): WorldDocumentBuilder");
    expect(wrapped).toContain("def configure(update: js.Dynamic => Unit): WorldDocumentBuilder");
    expect(wrapped).toContain('.deploy(RuntimeDeployment((network, incoming) => js.Dictionary("1" -> point(10, 20))))');
    expect(wrapped).toContain('.configure(config => config.updateDynamic("deployment")(js.Dynamic.literal(kind = "manual")))');
  });

  it("still injects an empty world builder when no world document is provided", () => {
    const wrapped = wrapStandaloneRuntimeCode("val program = new MyProgram");

    expect(wrapped).toContain("def runtimeWorldDocument: WorldDocumentBuilder = {");
    expect(wrapped).toContain("val world = WorldDocumentBuilder()");
    expect(wrapped).toContain("val program = new MyProgram");
  });
});