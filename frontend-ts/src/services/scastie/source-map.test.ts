import { describe, expect, it } from "vitest";

import { buildWrappedSource } from "./source-map";

const WORLD = `world
  .grid(rows = 10, cols = 10, stepX = 60, stepY = 60, tolerance = 10)
  .radius(70)`;

function wrappedLineText(code: string, line: number): string {
  return code.split("\n")[line - 1];
}

describe("buildWrappedSource", () => {
  it("maps every editor line of an easy-Scala program onto its wrapped line", () => {
    const code = "//using StandardSensors\n\nval g = 1\n\nmid()";
    const source = buildWrappedSource(code, "easy-scala", WORLD);

    for (const [index, editorLine] of code.split("\n").entries()) {
      const wrapped = source.toWrapped("code", { line: index + 1, ch: 0 });
      expect(wrapped, `line ${index + 1}`).toBeDefined();
      expect(wrappedLineText(source.code, wrapped!.line).trim()).toBe(
        // the `//using` directive is replaced by a blank line, everything else is verbatim
        index === 0 ? "" : editorLine.trim(),
      );
    }
  });

  it("round-trips code positions through the wrapped source", () => {
    const code = "//using StandardSensors\n\nval g = 1\n\nfoo(bar)";
    const source = buildWrappedSource(code, "easy-scala", WORLD);

    const wrapped = source.toWrapped("code", { line: 5, ch: 4 })!;
    expect(wrappedLineText(source.code, wrapped.line)).toBe("    foo(bar)");
    expect(wrapped.ch).toBe(8);
    expect(source.toEditor(wrapped)).toEqual({ tab: "code", line: 5, ch: 4 });
  });

  it("round-trips world-document positions", () => {
    const source = buildWrappedSource("mid()", "easy-scala", WORLD);

    const wrapped = source.toWrapped("world", { line: 3, ch: 3 })!;
    expect(wrappedLineText(source.code, wrapped.line)).toBe("      .radius(70)");
    expect(wrapped.ch).toBe(7);
    expect(source.toEditor(wrapped)).toEqual({ tab: "world", line: 3, ch: 3 });
  });

  it("maps full-Scala sources without the generated class prelude", () => {
    const code = "class MyProgram extends AggregateProgram {\n  override def main(): Any = mid()\n}\nval program = new MyProgram";
    const source = buildWrappedSource(code, "full-scala", WORLD);

    const wrapped = source.toWrapped("code", { line: 2, ch: 2 })!;
    expect(wrappedLineText(source.code, wrapped.line)).toBe("  override def main(): Any = mid()");
    expect(wrapped.ch).toBe(2);
    expect(source.toEditor(wrapped)).toEqual({ tab: "code", line: 2, ch: 2 });
  });

  it("keeps the mapping stable when no world document is supplied", () => {
    const source = buildWrappedSource("\n\nmid()", "easy-scala");

    const wrapped = source.toWrapped("code", { line: 3, ch: 0 })!;
    expect(wrappedLineText(source.code, wrapped.line)).toBe("    mid()");
    expect(source.toEditor(wrapped)).toEqual({ tab: "code", line: 3, ch: 0 });
    expect(source.toWrapped("world", { line: 1, ch: 0 })).toBeUndefined();
  });

  it("accounts for tab expansion in the code document", () => {
    const source = buildWrappedSource("\tmid()", "easy-scala");

    const wrapped = source.toWrapped("code", { line: 1, ch: 1 })!;
    expect(wrappedLineText(source.code, wrapped.line)).toBe("      mid()");
    expect(wrapped.ch).toBe(6);
    expect(source.toEditor(wrapped)).toEqual({ tab: "code", line: 1, ch: 1 });
  });

  it("returns no editor position for template lines", () => {
    const source = buildWrappedSource("mid()", "easy-scala", WORLD);
    expect(source.toEditor({ line: 1, ch: 0 })).toBeUndefined();
  });

  it("resolves offsets that point at the mapped text", () => {
    const source = buildWrappedSource("mid()", "easy-scala", WORLD);

    const wrapped = source.toWrapped("code", { line: 1, ch: 3 })!;
    const offset = source.offsetOf(wrapped);
    expect(source.code.slice(offset - 3, offset)).toBe("mid");
  });

  it("does not mangle Scala interpolator dollar escapes", () => {
    const code = 'val label = s"cost: $$${amount}"';
    const source = buildWrappedSource(code, "easy-scala", WORLD);
    expect(source.code).toContain('    val label = s"cost: $$${amount}"');
  });
});
