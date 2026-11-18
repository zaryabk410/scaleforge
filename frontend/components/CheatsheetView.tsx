"use client";

import { useMemo, useState } from "react";
import { SHEETS } from "@/lib/cheatsheet";

export default function CheatsheetView() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const tags = Array.from(new Set(SHEETS.map((s) => s.tag)));
  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return SHEETS.filter((s) => (!tag || s.tag === tag) && (!needle || JSON.stringify(s).toLowerCase().includes(needle)));
  }, [q, tag]);
  return (
    <>
      <div className="row no-print" style={{ marginBottom: 18 }}>
        <input type="text" placeholder="Search: redis, 99.9, shard, 429…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        <div className="tabs">
          <button className={tag === "" ? "on" : ""} onClick={() => setTag("")}>all</button>
          {tags.map((t) => <button key={t} className={tag === t ? "on" : ""} onClick={() => setTag(t)}>{t}</button>)}
        </div>
        <div className="spacer" />
        <button className="btn ghost sm" onClick={() => window.print()}>Print / PDF</button>
      </div>
      <div className="cs">
        {list.map((s) => (
          <div key={s.title} className="card flat">
            <div className="row between"><h3 style={{ margin: 0 }}>{s.title}</h3><span className="pill">{s.tag}</span></div>
            <div style={{ marginTop: 10 }}>
              {s.kind === "table" ? (
                <table className="t">
                  {s.head && <thead><tr>{s.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>}
                  <tbody>{s.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === r.length - 1 && r.length === 2 ? "mono" : undefined}>{c}</td>)}</tr>)}</tbody>
                </table>
              ) : (
                <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{s.items.map((it) => <li key={it}>{it}</li>)}</ul>
              )}
              {s.note && <p className="tiny muted" style={{ margin: "8px 0 0" }}>{s.note}</p>}
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="muted">Nothing matches.</p>}
      </div>
    </>
  );
}
