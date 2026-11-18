import React from "react";

function inline(text: string, key: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={`${key}-${i++}`}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) parts.push(<code key={`${key}-${i++}`}>{tok.slice(1, -1)}</code>);
    else parts.push(<em key={`${key}-${i++}`}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Minimal markdown: paragraphs, "- " bullets, "#### " headings, **bold**, *em*, `code`. */
export function Md({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className="prose">
      {blocks.map((b, bi) => {
        const lines = b.split("\n").map((l) => l.trim());
        if (lines.every((l) => l.startsWith("- "))) {
          return <ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.slice(2), li)}</li>)}</ul>;
        }
        if (lines[0].startsWith("#### ")) {
          return (
            <React.Fragment key={bi}>
              <h4>{inline(lines[0].slice(5), 0)}</h4>
              {lines.length > 1 && <p>{inline(lines.slice(1).join(" "), 1)}</p>}
            </React.Fragment>
          );
        }
        return <p key={bi}>{inline(lines.join(" "), bi)}</p>;
      })}
    </div>
  );
}
