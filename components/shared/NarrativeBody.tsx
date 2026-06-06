// Renders an AI narrative that mixes a short prose read with structured
// data lines (the watchlist signal report, a discovery flag list). Prose
// renders as editorial paragraphs; runs of "TICKER — …" lines render as a
// clean monospace block. Old prose-only narratives (no data lines) render
// exactly as before, so historical snapshots are unaffected.

type Block =
  | { kind: "prose"; text: string }
  | { kind: "list"; items: string[] };

// A data line is "TICKER — …" (em/en dash or hyphen, surrounded by spaces)
// or an "N others quiet" summary line. Data lines never end in a period —
// that's what keeps them distinct from prose sentences that happen to open
// with an all-caps word.
const TICKER_LINE = /^[A-Z]{2,6}(?:\.[A-Z]{1,3})?\s+[—–-]\s+\S/;
const SUMMARY_LINE = /^\d+\s+others?\b/i;

function isDataLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (SUMMARY_LINE.test(t)) return true;
  return TICKER_LINE.test(t) && !t.endsWith(".");
}

export function parseNarrativeBlocks(narrative: string): Block[] {
  const blocks: Block[] = [];
  let prose: string[] = [];
  let list: string[] = [];

  const flushProse = () => {
    if (!prose.length) return;
    // Blank lines separate paragraphs; single newlines within a paragraph
    // collapse to spaces.
    prose
      .join("\n")
      .split(/\n\s*\n/)
      .forEach((p) => {
        const text = p.replace(/\s*\n\s*/g, " ").trim();
        if (text) blocks.push({ kind: "prose", text });
      });
    prose = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push({ kind: "list", items: list });
    list = [];
  };

  for (const raw of narrative.split("\n")) {
    if (isDataLine(raw)) {
      flushProse();
      list.push(raw.trim());
    } else {
      flushList();
      prose.push(raw);
    }
  }
  flushProse();
  flushList();
  return blocks;
}

// Renders the parsed blocks as fragment children. The caller supplies the
// wrapping element (typically a `.prose-editorial` container) so each call
// site keeps its own spacing/border treatment.
export function NarrativeBody({ narrative }: { narrative: string }) {
  const blocks = parseNarrativeBlocks(narrative);
  return (
    <>
      {blocks.map((b, i) =>
        b.kind === "prose" ? (
          <p key={i}>{b.text}</p>
        ) : (
          <div
            key={i}
            className="my-3 space-y-1 font-data text-[13px] leading-relaxed text-[var(--text-secondary)]"
          >
            {b.items.map((item, j) => (
              <div key={j}>{item}</div>
            ))}
          </div>
        ),
      )}
    </>
  );
}
