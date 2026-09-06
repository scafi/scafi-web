import type { Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import type { Text } from "@codemirror/state";

import type { CompileProblem, CompileSeverity } from "../../domain/contracts";
import type { MappedTab, WrappedSource } from "../../services/scastie/source-map";

export type DiagnosticTab = MappedTab | "renderer";

const SEVERITY: Record<CompileSeverity, Diagnostic["severity"]> = {
  error: "error",
  warning: "warning",
  info: "info",
};

/** Converts a 1-based line / 0-based column pair into a document offset, clamped to the line. */
export function toOffset(doc: Text, line: number, ch: number): number | undefined {
  if (line < 1 || line > doc.lines) {
    return undefined;
  }
  const target = doc.line(line);
  return target.from + Math.min(Math.max(0, ch), target.length);
}

/**
 * Maps compiler messages onto editor ranges. A problem that lands in the runtime template
 * rather than in user code has no editor position; those are returned separately so the
 * caller can keep showing them in the banner instead of dropping them silently.
 */
export function toEditorDiagnostics(
  problems: readonly CompileProblem[],
  source: WrappedSource,
  tab: MappedTab,
  doc: Text,
): { diagnostics: Diagnostic[]; unmapped: CompileProblem[] } {
  const diagnostics: Diagnostic[] = [];
  const unmapped: CompileProblem[] = [];

  for (const problem of problems) {
    if (problem.severity !== "error") {
      continue;
    }
    if (problem.line === undefined) {
      unmapped.push(problem);
      continue;
    }
    const start = source.toEditor({ line: problem.line, ch: problem.startColumn ?? 0 });
    if (!start || start.tab !== tab) {
      unmapped.push(problem);
      continue;
    }
    const endPosition = source.toEditor({
      line: problem.endLine ?? problem.line,
      ch: problem.endColumn ?? (problem.startColumn ?? 0) + 1,
    });
    const end = endPosition && endPosition.tab === tab ? endPosition : start;

    const from = toOffset(doc, start.line, start.ch);
    if (from === undefined) {
      unmapped.push(problem);
      continue;
    }
    const to = toOffset(doc, end.line, end.ch) ?? from;

    diagnostics.push({
      from,
      // An empty range would render nothing, so always cover at least one character.
      to: Math.max(to, Math.min(from + 1, doc.length)),
      severity: SEVERITY[problem.severity],
      source: "scala",
      message: problem.message,
      actions: problem.actions.map((action) => ({
        name: action.title,
        apply: (view: EditorView) => {
          const changes = action.edits.flatMap((edit) => {
            const editStart = source.toEditor({ line: edit.startLine, ch: edit.startColumn });
            const editEnd = source.toEditor({ line: edit.endLine, ch: edit.endColumn });
            if (!editStart || !editEnd || editStart.tab !== tab || editEnd.tab !== tab) {
              return [];
            }
            const editFrom = toOffset(view.state.doc, editStart.line, editStart.ch);
            const editTo = toOffset(view.state.doc, editEnd.line, editEnd.ch);
            if (editFrom === undefined || editTo === undefined) {
              return [];
            }
            return [{ from: Math.min(editFrom, editTo), to: Math.max(editFrom, editTo), insert: edit.newText }];
          });
          if (changes.length > 0) {
            view.dispatch({ changes });
          }
        },
      })),
    });
  }

  return { diagnostics, unmapped };
}

const OPENING: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

/**
 * A cheap structural check that runs on every keystroke, well before anything is compiled:
 * unbalanced brackets and unterminated strings, skipping comments and string contents.
 */
export function findStructuralProblems(code: string): Array<{ from: number; to: number; message: string }> {
  const problems: Array<{ from: number; to: number; message: string }> = [];
  const stack: Array<{ character: string; at: number }> = [];

  let index = 0;
  while (index < code.length) {
    const character = code[index];
    const next = code[index + 1];

    if (character === "/" && next === "/") {
      const lineEnd = code.indexOf("\n", index);
      index = lineEnd === -1 ? code.length : lineEnd;
      continue;
    }
    if (character === "/" && next === "*") {
      const commentEnd = code.indexOf("*/", index + 2);
      index = commentEnd === -1 ? code.length : commentEnd + 2;
      continue;
    }
    if (character === '"') {
      const isTriple = code.startsWith('"""', index);
      const closer = isTriple ? '"""' : '"';
      let cursor = index + closer.length;
      let terminated = false;
      while (cursor < code.length) {
        if (!isTriple && code[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (!isTriple && code[cursor] === "\n") {
          break;
        }
        if (code.startsWith(closer, cursor)) {
          terminated = true;
          cursor += closer.length;
          break;
        }
        cursor += 1;
      }
      if (!terminated) {
        problems.push({ from: index, to: Math.min(cursor, code.length), message: "Unterminated string literal" });
      }
      index = cursor;
      continue;
    }
    if (character === "'" && code[index + 2] === "'") {
      index += 3;
      continue;
    }

    if (character === "(" || character === "[" || character === "{") {
      stack.push({ character, at: index });
    } else if (character in OPENING) {
      const open = stack.pop();
      if (!open) {
        problems.push({ from: index, to: index + 1, message: `Unmatched closing '${character}'` });
      } else if (open.character !== OPENING[character]) {
        problems.push({
          from: index,
          to: index + 1,
          message: `Expected '${closerFor(open.character)}' to close '${open.character}', found '${character}'`,
        });
      }
    }
    index += 1;
  }

  for (const open of stack) {
    problems.push({
      from: open.at,
      to: open.at + 1,
      message: `Unclosed '${open.character}' — missing '${closerFor(open.character)}'`,
    });
  }

  return problems;
}

function closerFor(open: string): string {
  return open === "(" ? ")" : open === "[" ? "]" : "}";
}
