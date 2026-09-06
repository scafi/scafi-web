import { describe, expect, it } from "vitest";
import { Text } from "@codemirror/state";

import { buildWrappedSource } from "../../services/scastie/source-map";
import { findStructuralProblems, toEditorDiagnostics } from "./editor-diagnostics";
import type { CompileProblem } from "../../domain/contracts";

const WORLD = "world\n  .radius(70)";

function problem(overrides: Partial<CompileProblem>): CompileProblem {
  return { severity: "error", message: "boom", actions: [], ...overrides };
}

describe("toEditorDiagnostics", () => {
  it("puts a compiler message on the editor line it came from, blank lines included", () => {
    const code = "//using StandardSensors\n\nval a = 1\n\nval b: String = 42";
    const source = buildWrappedSource(code, "easy-scala", WORLD);
    const doc = Text.of(code.split("\n"));

    // Where the compiler would actually report the error on the wrapped source.
    const wrapped = source.toWrapped("code", { line: 5, ch: 16 })!;

    const { diagnostics, unmapped } = toEditorDiagnostics(
      [problem({ message: "type mismatch", line: wrapped.line, endLine: wrapped.line, startColumn: wrapped.ch, endColumn: wrapped.ch + 2 })],
      source,
      "code",
      doc,
    );

    expect(unmapped).toEqual([]);
    expect(diagnostics).toHaveLength(1);
    expect(doc.lineAt(diagnostics[0].from).number).toBe(5);
    expect(doc.sliceString(diagnostics[0].from, diagnostics[0].to)).toBe("42");
  });

  it("reports problems that land in the runtime template as unmapped rather than dropping them", () => {
    const source = buildWrappedSource("mid()", "easy-scala", WORLD);
    const doc = Text.of(["mid()"]);

    const { diagnostics, unmapped } = toEditorDiagnostics([problem({ line: 1, startColumn: 0 })], source, "code", doc);

    expect(diagnostics).toEqual([]);
    expect(unmapped).toHaveLength(1);
  });

  it("keeps positionless messages out of the gutter", () => {
    const source = buildWrappedSource("mid()", "easy-scala", WORLD);
    const { diagnostics, unmapped } = toEditorDiagnostics([problem({})], source, "code", Text.of(["mid()"]));

    expect(diagnostics).toEqual([]);
    expect(unmapped).toHaveLength(1);
  });

  it("leaves warnings to the banner", () => {
    const source = buildWrappedSource("mid()", "easy-scala", WORLD);
    const wrapped = source.toWrapped("code", { line: 1, ch: 0 })!;
    const { diagnostics } = toEditorDiagnostics(
      [problem({ severity: "warning", line: wrapped.line, startColumn: wrapped.ch })],
      source,
      "code",
      Text.of(["mid()"]),
    );

    expect(diagnostics).toEqual([]);
  });

  it("exposes quick fixes mapped back to editor coordinates", () => {
    const code = "val x = 1";
    const source = buildWrappedSource(code, "easy-scala", WORLD);
    const doc = Text.of([code]);
    const wrapped = source.toWrapped("code", { line: 1, ch: 4 })!;

    const { diagnostics } = toEditorDiagnostics(
      [problem({
        line: wrapped.line,
        startColumn: wrapped.ch,
        endColumn: wrapped.ch + 1,
        actions: [{
          title: "Rename to y",
          edits: [{ startLine: wrapped.line, startColumn: wrapped.ch, endLine: wrapped.line, endColumn: wrapped.ch + 1, newText: "y" }],
        }],
      })],
      source,
      "code",
      doc,
    );

    expect(diagnostics[0].actions?.[0].name).toBe("Rename to y");

    const dispatched: unknown[] = [];
    diagnostics[0].actions![0].apply({ state: { doc }, dispatch: (t: unknown) => dispatched.push(t) } as never, 0, 0);
    expect(dispatched).toEqual([{ changes: [{ from: 4, to: 5, insert: "y" }] }]);
  });
});

describe("findStructuralProblems", () => {
  it("accepts balanced code", () => {
    expect(findStructuralProblems('rep(0) { x => x + f("a{b(") }')).toEqual([]);
  });

  it("reports an unclosed brace", () => {
    const problems = findStructuralProblems("rep(0) { x => x");
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("Unclosed '{'");
  });

  it("reports a mismatched closer", () => {
    expect(findStructuralProblems("foo(a]")[0].message).toContain("found ']'");
  });

  it("reports an unmatched closer", () => {
    expect(findStructuralProblems("foo())")[0].message).toContain("Unmatched closing ')'");
  });

  it("reports an unterminated string", () => {
    expect(findStructuralProblems('val a = "oops').map((p) => p.message)).toContain("Unterminated string literal");
  });

  it("ignores brackets inside comments and triple-quoted strings", () => {
    expect(findStructuralProblems('// a ( comment\n/* another { */\nval s = """a ] b"""\n')).toEqual([]);
  });
});
