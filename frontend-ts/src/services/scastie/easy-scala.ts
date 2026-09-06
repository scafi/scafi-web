const USING_PATTERN = /(?:\s*\/\/\s*using\s*)(\w*(?:\s*,\s*\w+)*)/;

/** Number of lines emitted before the user body inside the generated `MyProgram` class. */
export const EASY_SCALA_PRELUDE_LINES = 2;

/** Indentation applied to every non-blank line of the user body. */
export const EASY_SCALA_BODY_INDENT = 4;

export interface EasyScalaWrap {
  /** The full Scala source. */
  code: string;
  /** 1-based line of `code` holding the first line of the user body. */
  bodyStartLine: number;
  /** Columns added to every non-blank body line. */
  bodyIndent: number;
}

function countNewlines(value: string): number {
  let count = 0;
  for (const character of value) {
    if (character === "\n") {
      count += 1;
    }
  }
  return count;
}

/**
 * Splits the `// using A, B` directive off the source without changing the line count:
 * the directive is replaced by exactly as many newlines as it consumed, so a position in
 * the returned body still refers to the same line of the original document.
 */
function extractUsingDirective(code: string): { libraries: string; body: string } {
  const matched = code.match(USING_PATTERN);
  if (!matched) {
    return { libraries: "", body: code };
  }
  const preservedNewlines = "\n".repeat(countNewlines(matched[0]));
  return {
    libraries: matched[1]?.trim() ?? "",
    // Function replacer: a string replacement would interpret `$&`, `$$`, `` $` `` and `$'`.
    body: code.replace(USING_PATTERN, () => preservedNewlines),
  };
}

export function wrapEasyScala(code: string): EasyScalaWrap {
  const { libraries, body } = extractUsingDirective(code);
  const libsCode = libraries ? `with ${libraries.replace(/\s*,\s*/g, " with ")}` : "";
  const padding = " ".repeat(EASY_SCALA_BODY_INDENT);
  const shiftedBody = body
    .split("\n")
    // Blank lines are kept so that line numbers survive the wrapping; indenting them
    // would only add trailing whitespace.
    .map((currentLine) => (currentLine.length > 0 ? `${padding}${currentLine}` : currentLine))
    .join("\n");

  return {
    code: `class MyProgram extends AggregateProgram ${libsCode} {
  override def main() : Any = {
${shiftedBody}
  }
}
val program = new MyProgram
`,
    bodyStartLine: EASY_SCALA_PRELUDE_LINES + 1,
    bodyIndent: EASY_SCALA_BODY_INDENT,
  };
}

export function convertEasyScalaToFull(code: string): string {
  return wrapEasyScala(code).code;
}
