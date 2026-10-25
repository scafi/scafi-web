import { describe, expect, it } from "vitest";
import { resolveEmbedProgram } from "./embed-program";
import { defaultConfiguration, defaultEditorDocument } from "./defaults";
import type { ExampleGroup } from "../domain/contracts";

const examples: ExampleGroup[] = [
  {
    groupName: "Basic",
    examples: [{ name: "Gradient", body: "gradient()", world: "world\n  .grid(rows = 4, cols = 6, stepX = 60, stepY = 60, tolerance = 10)\n  .radius(70)\n  .seed(config = 0L, simulation = 0L, randomSensor = 0L)" }],
  },
];

describe("resolveEmbedProgram", () => {
  it("defaults to the editor's default program and world", () => {
    const program = resolveEmbedProgram(new URLSearchParams("embed=true"), []);
    expect(program).toMatchObject({ code: defaultEditorDocument.code, mode: "easy-scala", configuration: defaultConfiguration });
  });

  it("loads an example by name, ignoring case", () => {
    const program = resolveEmbedProgram(new URLSearchParams("example=gradient"), examples);
    expect(program.code).toBe("gradient()");
    expect(program.configuration.network).toMatchObject({ kind: "grid", rows: 4, cols: 6 });
  });

  it("applies code, mode and grid overrides", () => {
    const program = resolveEmbedProgram(new URLSearchParams(`example=Gradient&code_b64=${btoa("mid()")}&mode=full-scala&grid=5x5`), examples);
    expect(program).toMatchObject({ code: "mid()", mode: "full-scala" });
    expect(program.configuration.network).toMatchObject({ rows: 5, cols: 5 });
  });
});
