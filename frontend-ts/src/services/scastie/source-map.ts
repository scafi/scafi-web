import { wrapEasyScala } from "./easy-scala";
import { wrapStandaloneRuntimeCodeWithMap, type RuntimeWrap } from "./runtime-template";

export type RuntimeWrapper = (core: string, worldDocument?: string) => RuntimeWrap;

export type ScalaSourceMode = "easy-scala" | "full-scala";

/** The two editor documents whose text ends up inside the wrapped Scala source. */
export type MappedTab = "code" | "world";

export interface Position {
  /** 1-based. */
  line: number;
  /** 0-based column. */
  ch: number;
}

export interface EditorPosition extends Position {
  tab: MappedTab;
}

/**
 * Scastie receives the user's code and world document embedded in the standalone runtime
 * template. Every compiler position therefore refers to the wrapped source, and every
 * completion request has to be expressed in wrapped coordinates. This carries the wrapped
 * text together with the mapping in both directions.
 */
export interface WrappedSource {
  /** Exactly what is sent to Scastie and to Metals. */
  code: string;
  /** Editor coordinates to wrapped-source coordinates. */
  toWrapped(tab: MappedTab, position: Position): Position | undefined;
  /** Wrapped-source coordinates back to the editor. `undefined` for template lines. */
  toEditor(position: Position): EditorPosition | undefined;
  /** Wrapped coordinates as a character offset into `code`, for the Metals API. */
  offsetOf(position: Position): number;
}

interface Region {
  tab: MappedTab;
  /** 1-based line of the wrapped source holding this region's first line. */
  wrappedStartLine: number;
  /** Original editor lines, before tab expansion and indentation. */
  editorLines: string[];
  /** Whether tabs were expanded to two spaces on the way in. */
  expandsTabs: boolean;
  /** Columns prefixed to each line of the region. */
  columnShift: number;
  /** Whether blank lines also carry the indentation. */
  indentsBlankLines: boolean;
}

/** Scastie rejects hard tabs inconsistently, so the code document is expanded on the way in. */
export function normalizeScalaSource(code: string): string {
  return code.replace(/\t/g, "  ");
}

function expandTabs(value: string, expandsTabs: boolean): string {
  return expandsTabs ? normalizeScalaSource(value) : value;
}

/**
 * Maps a column of the original line onto the same column after tab expansion.
 * Each tab widens the prefix by one character.
 */
function toExpandedColumn(editorLine: string, ch: number, expandsTabs: boolean): number {
  return expandTabs(editorLine.slice(0, Math.max(0, ch)), expandsTabs).length;
}

/** Inverse of {@link toExpandedColumn}: walks the original line until the expanded width matches. */
function toEditorColumn(editorLine: string, expandedCh: number, expandsTabs: boolean): number {
  if (!expandsTabs) {
    return Math.min(expandedCh, editorLine.length);
  }
  let expanded = 0;
  for (let index = 0; index < editorLine.length; index += 1) {
    if (expanded >= expandedCh) {
      return index;
    }
    expanded += editorLine[index] === "\t" ? 2 : 1;
  }
  return editorLine.length;
}

/** The easy-Scala wrapper leaves blank lines unindented; the world document indents every line. */
function columnShiftFor(region: Region, editorLine: string): number {
  if (editorLine.length === 0 && !region.indentsBlankLines) {
    return 0;
  }
  return region.columnShift;
}

function buildLineStarts(code: string): number[] {
  const starts = [0];
  for (let index = 0; index < code.length; index += 1) {
    if (code[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
}

export function buildWrappedSource(
  code: string,
  mode: ScalaSourceMode,
  worldDocument?: string,
  wrapRuntime: RuntimeWrapper = wrapStandaloneRuntimeCodeWithMap,
): WrappedSource {
  const normalizedCode = normalizeScalaSource(code);
  const regions: Region[] = [];

  let core: string;
  let coreOffsetLines: number;
  let coreIndent: number;
  if (mode === "easy-scala") {
    const wrapped = wrapEasyScala(normalizedCode);
    core = wrapped.code;
    coreOffsetLines = wrapped.bodyStartLine - 1;
    coreIndent = wrapped.bodyIndent;
  } else {
    core = normalizedCode;
    coreOffsetLines = 0;
    coreIndent = 0;
  }

  const runtime = wrapRuntime(core, worldDocument);

  regions.push({
    tab: "code",
    wrappedStartLine: runtime.userStartLine + coreOffsetLines,
    editorLines: code.split("\n"),
    expandsTabs: true,
    columnShift: coreIndent,
    indentsBlankLines: false,
  });

  // An absent world document is replaced by a synthesized `world` line that belongs to
  // nobody, so there is nothing to map.
  if (worldDocument !== undefined && worldDocument.trim().length > 0) {
    regions.push({
      tab: "world",
      wrappedStartLine: runtime.worldStartLine,
      editorLines: worldDocument.split("\n"),
      expandsTabs: false,
      columnShift: runtime.worldIndent,
      indentsBlankLines: true,
    });
  }

  const lineStarts = buildLineStarts(runtime.code);

  return {
    code: runtime.code,

    toWrapped(tab, position) {
      const region = regions.find((candidate) => candidate.tab === tab);
      if (!region) {
        return undefined;
      }
      const index = position.line - 1;
      const editorLine = region.editorLines[index];
      if (editorLine === undefined) {
        return undefined;
      }
      const wrappedLine = region.wrappedStartLine + index;
      if (wrappedLine > lineStarts.length) {
        return undefined;
      }
      const expanded = toExpandedColumn(editorLine, position.ch, region.expandsTabs);
      return { line: wrappedLine, ch: expanded + columnShiftFor(region, editorLine) };
    },

    toEditor(position) {
      for (const region of regions) {
        const index = position.line - region.wrappedStartLine;
        if (index < 0 || index >= region.editorLines.length) {
          continue;
        }
        const editorLine = region.editorLines[index];
        const expanded = Math.max(0, position.ch - columnShiftFor(region, editorLine));
        return {
          tab: region.tab,
          line: index + 1,
          ch: toEditorColumn(editorLine, expanded, region.expandsTabs),
        };
      }
      return undefined;
    },

    offsetOf(position) {
      const start = lineStarts[position.line - 1];
      if (start === undefined) {
        return runtime.code.length;
      }
      const nextStart = lineStarts[position.line] ?? runtime.code.length + 1;
      const lineLength = Math.max(0, nextStart - start - 1);
      return start + Math.min(Math.max(0, position.ch), lineLength);
    },
  };
}
