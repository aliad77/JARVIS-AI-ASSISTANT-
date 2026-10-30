/**
 * Renders assistant text safely: a tiny Markdown subset as React elements
 * plus KaTeX for $...$ / $$...$$ math.
 *
 * AI output is untrusted. No HTML from the message is ever injected. The only
 * innerHTML used is KaTeX's own output, rendered with `trust: false` (no
 * \href, \url, \includegraphics, or HTML extensions) and size limits. URLs
 * are shown as plain text, never as clickable links.
 */
import katex from "katex";
import { Fragment, memo, type ReactNode } from "react";

type Segment = { kind: "text"; value: string } | { kind: "math"; value: string; display: boolean };

const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g;

export function splitMath(input: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of input.matchAll(MATH_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: "text", value: input.slice(last, idx) });
    const display = m[1] !== undefined || m[2] !== undefined;
    out.push({ kind: "math", value: (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim(), display });
    last = idx + m[0].length;
  }
  if (last < input.length) out.push({ kind: "text", value: input.slice(last) });
  return out;
}

export function renderKatex(tex: string, display: boolean): string {
  return katex.renderToString(tex.slice(0, 2000), {
    displayMode: display,
    throwOnError: false,
    trust: false,
    strict: "ignore",
    maxSize: 20,
    maxExpand: 200,
    output: "htmlAndMathml", // MathML gives screen readers the equation
  });
}

function MathSpan({ tex, display }: { tex: string; display: boolean }) {
  const html = renderKatex(tex, display);
  const Tag = display ? "div" : "span";
  return <Tag className={display ? "my-2" : undefined} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Inline markdown: **bold**, _italic_ / *italic*, `code`. Returns React nodes only. */
function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|_[^_\s][^_]*_|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(text.slice(last, idx));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) nodes.push(<strong key={key} className="text-red-hi">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) nodes.push(<code key={key} className="rounded bg-void px-1 font-mono text-[0.9em] text-red-hi">{tok.slice(1, -1)}</code>);
    else nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = idx + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderLine(line: string, key: string): ReactNode {
  const segs = splitMath(line);
  return segs.map((s, i) =>
    s.kind === "math" ? (
      <MathSpan key={`${key}-m${i}`} tex={s.value} display={s.display} />
    ) : (
      <Fragment key={`${key}-t${i}`}>{inline(s.value, `${key}-t${i}`)}</Fragment>
    ),
  );
}

type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul" | "ol"; items: string[]; start?: number }
  | { type: "h"; text: string }
  | { type: "math"; tex: string };

export function toBlocks(content: string): Block[] {
  // Pull display math out first so multi-line $$ blocks survive line splitting.
  const parts = content.split(/(\$\$[\s\S]+?\$\$)/g);
  const blocks: Block[] = [];
  for (const part of parts) {
    if (part.startsWith("$$") && part.endsWith("$$") && part.length > 4) {
      blocks.push({ type: "math", tex: part.slice(2, -2).trim() });
      continue;
    }
    let para: string[] = [];
    let list: { type: "ul" | "ol"; items: string[]; start?: number } | null = null;
    const flush = () => {
      if (para.length) blocks.push({ type: "p", lines: para });
      if (list) blocks.push(list);
      para = [];
      list = null;
    };
    for (const raw of part.split("\n")) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        flush();
        continue;
      }
      const ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
      const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
      const h = /^#{1,4}\s+(.*)$/.exec(line);
      if (h) {
        flush();
        blocks.push({ type: "h", text: h[1] });
      } else if (ol || ul) {
        const type = ol ? "ol" : "ul";
        if (para.length) {
          blocks.push({ type: "p", lines: para });
          para = [];
        }
        if (!list || list.type !== type) {
          if (list) blocks.push(list);
          // Keep the author's numbering when a list is split by display math.
          list = ol ? { type, items: [], start: Number(ol[1]) } : { type, items: [] };
        }
        list.items.push(ol ? ol[2] : ul![1]);
      } else {
        if (list) {
          blocks.push(list);
          list = null;
        }
        para.push(line);
      }
    }
    flush();
  }
  return blocks;
}

export const MathText = memo(function MathText({ content, className }: { content: string; className?: string }) {
  const blocks = toBlocks(content);
  return (
    <div className={`space-y-2 leading-relaxed break-words ${className ?? ""}`}>
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.type) {
          case "math":
            return <MathSpan key={key} tex={b.tex} display />;
          case "h":
            return (
              <p key={key} className="pixel-title pt-1 text-[0.7rem] text-red">
                {renderLine(b.text, key)}
              </p>
            );
          case "ul":
          case "ol": {
            const List = b.type;
            return (
              <List key={key} start={b.type === "ol" && b.start && b.start > 1 ? b.start : undefined} className={`space-y-1 pl-6 ${b.type === "ol" ? "list-decimal" : "list-[square]"} marker:text-red`}>
                {b.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{renderLine(item, `${key}-${j}`)}</li>
                ))}
              </List>
            );
          }
          default:
            return (
              <p key={key}>
                {b.lines.map((l, j) => (
                  <Fragment key={`${key}-${j}`}>
                    {j > 0 && <br />}
                    {renderLine(l, `${key}-${j}`)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
});

/** Plain text for speech synthesis: drop markdown and turn LaTeX into readable words. */
export function toSpeech(content: string): string {
  return content
    .replace(/\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g, (_m, a: string | undefined, b: string | undefined) => latexToWords(a ?? b ?? ""))
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function latexToWords(tex: string): string {
  return tex
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1 over $2")
    .replace(/\\sqrt\{([^}]*)\}/g, "square root of $1")
    .replace(/\^\{?2\}?/g, " squared")
    .replace(/\^\{?3\}?/g, " cubed")
    .replace(/\^\{?([^}\s]+)\}?/g, " to the power $1")
    .replace(/\\times|\\cdot/g, " times ")
    .replace(/\\div/g, " divided by ")
    .replace(/\\pm/g, " plus or minus ")
    .replace(/\\neq/g, " is not equal to ")
    .replace(/\\le(q)?/g, " less than or equal to ")
    .replace(/\\ge(q)?/g, " greater than or equal to ")
    .replace(/=/g, " equals ")
    .replace(/-/g, " minus ")
    .replace(/\+/g, " plus ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}\\]/g, " ");
}
