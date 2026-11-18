"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LESSONS } from "@/lib/lessons";
import { getUid, load } from "@/lib/uid";

type P = { detail: Record<string, Record<string, { best: number; passed: boolean; attempts: number }>>; totals: Record<string, { done: number; total: number }> };

export default function ProgressPage() {
  const [p, setP] = useState<P | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [uid, setUid] = useState("");
  useEffect(() => {
    const id = getUid();
    setUid(id);
    setDone(load<string[]>("sf_done", []));
    api<P>(`/progress/${id}`).then(setP).catch((e) => setErr(e.message));
  }, []);
  const bars: [string, number, number, string][] = [
    ["Lessons completed", done.length, LESSONS.length, "/learn"],
    ...(p ? ([
      ["Challenges passed", p.totals.scenarios.done, p.totals.scenarios.total, "/lab"],
      ["Quiz topics passed (≥70%)", p.totals.quizzes.done, p.totals.quizzes.total, "/practice?tab=quiz"],
      ["Estimations solved", p.totals.estimations.done, p.totals.estimations.total, "/practice?tab=estimations"],
      ["Mock interviews ≥70%", p.totals.interviews.done, p.totals.interviews.total, "/practice?tab=interviews"],
    ] as [string, number, number, string][]) : []),
  ];
  return (
    <main className="container page">
      <div className="eyebrow">Your progress</div>
      <h1>Progress</h1>
      <p className="muted small">Anonymous learner id <span className="mono">{uid}</span> (stored in this browser).</p>
      {err && <div className="err-banner">{err}</div>}
      <div className="grid g2" style={{ marginTop: 16 }}>
        {bars.map(([l, d, t, href]) => (
          <Link key={l} href={href} className="card link">
            <div className="row between"><b>{l}</b><span className="mono">{d}/{t}</span></div>
            <div className="util-bar" style={{ marginTop: 10, height: 10 }}><div style={{ width: `${t ? (100 * d) / t : 0}%`, background: "var(--teal)" }} /></div>
          </Link>
        ))}
      </div>
      {p && (
        <div className="grid g2" style={{ marginTop: 22 }}>
          {Object.entries(p.detail).filter(([, v]) => Object.keys(v).length).map(([kind, items]) => (
            <div key={kind} className="card flat">
              <h3 style={{ textTransform: "capitalize" }}>{kind}</h3>
              <table className="t"><thead><tr><th>Item</th><th className="num">Best</th><th className="num">Tries</th><th /></tr></thead><tbody>
                {Object.entries(items).map(([ref, v]) => (
                  <tr key={ref}><td>{ref}</td><td className="num">{v.best}%</td><td className="num">{v.attempts}</td><td>{v.passed ? "✅" : "…"}</td></tr>
                ))}
              </tbody></table>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
