"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Scene, { type SceneEdgeView, type SceneNodeView } from "@/components/three/Scene";
import { getLesson } from "@/lib/lessons";
import type { Lesson, Step } from "@/lib/lessons/types";
import { C } from "@/lib/lessons/types";
import { Md } from "@/lib/md";
import { load, save } from "@/lib/uid";

type Nb = { slug: string; title: string } | undefined;

function buildScene(lesson: Lesson, step: Step): { nodes: SceneNodeView[]; edges: SceneEdgeView[] } {
  const visible = new Set(step.show || lesson.scene.nodes.map((n) => n.id));
  const nodes: SceneNodeView[] = lesson.scene.nodes
    .filter((n) => visible.has(n.id))
    .map((n) => ({
      ...n,
      state: step.down?.includes(n.id) ? "down" : step.hot?.includes(n.id) ? "hot" : step.focus?.includes(n.id) ? "focus" : "normal",
      badge: step.badges?.[n.id],
    }));
  const key = (a: string, b: string) => `${a}>${b}`;
  const flows = new Map(step.flows.map((f) => [key(f[0], f[1]), f]));
  const all: [string, string][] = [...lesson.scene.edges, ...(step.edges || [])];
  const seen = new Set<string>();
  const edges: SceneEdgeView[] = [];
  for (const [a, b] of all) {
    if (!visible.has(a) || !visible.has(b)) continue;
    const k = key(a, b);
    if (seen.has(k)) continue;
    seen.add(k);
    const f = flows.get(k);
    const rev = flows.get(key(b, a));
    if (rev && !f) {
      if (!seen.has(key(b, a))) {
        seen.add(key(b, a));
        edges.push({ from: b, to: a, color: rev[2], rate: rev[3] ?? 1 });
      }
      continue;
    }
    edges.push({ from: a, to: b, color: f?.[2], rate: f ? f[3] ?? 1 : 0, dim: !f && step.flows.length > 0 });
  }
  // flows on pairs that are not declared edges still render
  for (const f of step.flows) {
    const k = key(f[0], f[1]);
    if (!seen.has(k) && visible.has(f[0]) && visible.has(f[1])) {
      seen.add(k);
      edges.push({ from: f[0], to: f[1], color: f[2], rate: f[3] ?? 1 });
    }
  }
  return { nodes, edges };
}

const LEGEND: [string, string][] = [
  [C.req, "request"], [C.read, "read"], [C.write, "write"], [C.async, "async"], [C.ok, "ok / hit"], [C.err, "overload / miss"], [C.vote, "control"],
];

export default function LessonView({ slug, prev, next }: { slug: string; prev: Nb; next: Nb }) {
  const lesson = getLesson(slug)!;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const step = lesson.steps[i];
  const scene = useMemo(() => buildScene(lesson, step), [lesson, step]);
  const last = lesson.steps.length - 1;

  useEffect(() => setDone(load<string[]>("sf_done", [])), []);
  useEffect(() => {
    if (i === last && !done.includes(slug)) {
      const d = [...done, slug];
      setDone(d);
      save("sf_done", d);
    }
  }, [i, last, slug, done]);

  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(last, x + d))), [last]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => (i < last ? setI(i + 1) : setPlaying(false)), 6500);
    return () => clearTimeout(t);
  }, [playing, i, last]);

  return (
    <main className="container wide page">
      <div className="row small muted" style={{ marginBottom: 6 }}>
        <Link href="/learn">Learn</Link> <span>/</span> <span>{lesson.track.replace("-", " ")}</span>
      </div>
      <div className="row between" style={{ alignItems: "flex-end", marginBottom: 18 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>{lesson.title}</h1>
          <p className="muted" style={{ margin: 0, maxWidth: 760 }}>{lesson.subtitle}</p>
        </div>
        <div className="row">
          <span className={`pill ${lesson.level}`}>{lesson.level}</span>
          <span className="pill">{lesson.minutes} min</span>
          {done.includes(slug) && <span className="pill ok">✓ completed</span>}
        </div>
      </div>

      <div className="lesson-wrap">
        <div className="stage">
          <div className="legend">
            {LEGEND.map(([c, l]) => (
              <span key={l}><i className="dot" style={{ background: c, width: 7, height: 7, marginRight: 4 }} />{l}</span>
            ))}
          </div>
          <Scene nodes={scene.nodes} edges={scene.edges} />
          <div className="stage-bar">
            <button className="btn ghost sm" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous step">←</button>
            <div className="stage-steps">
              {lesson.steps.map((_, k) => (
                <button key={k} className={k === i ? "on" : k < i ? "done" : ""} onClick={() => setI(k)} aria-label={`Step ${k + 1}`} />
              ))}
            </div>
            <button className="btn ghost sm" onClick={() => setPlaying((p) => !p)}>{playing ? "❚❚" : "▶"}</button>
            <button className="btn sm" onClick={() => go(1)} disabled={i === last}>Next →</button>
          </div>
        </div>

        <div>
          {lesson.steps.map((s, k) => (
            <div key={k} className="step-card" style={{ opacity: k === i ? 1 : 0.45, borderLeftColor: k === i ? "var(--terra)" : "var(--line)", cursor: "pointer" }}
              onClick={() => setI(k)}>
              <div className="mono tiny muted">STEP {k + 1} / {lesson.steps.length}</div>
              <h3>{s.title}</h3>
              {k === i ? <Md text={s.body} /> : <p className="small muted" style={{ margin: 0 }}>{s.body.replace(/[*`]/g, "").slice(0, 110)}…</p>}
            </div>
          ))}
          <p className="tiny muted">Tip: use ← → keys. Drag to orbit, scroll to zoom.</p>
        </div>
      </div>

      <hr />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 1fr)", gap: 28 }}>
        <div>
          <div className="eyebrow">Deep dive</div>
          {lesson.sections.map((s) => (
            <section key={s.title} className="section-block">
              <h2>{s.title}</h2>
              <Md text={s.body} />
            </section>
          ))}
          {lesson.tradeoffs && (
            <section className="section-block">
              <h2>Trade-offs</h2>
              <div className={`grid ${lesson.tradeoffs.length >= 3 ? "g3" : "g2"}`}>
                {lesson.tradeoffs.map((t) => (
                  <div key={t.option} className="tradeoff">
                    <h4>{t.option}</h4>
                    {t.pros.map((p) => <div key={p} className="small pro">{p}</div>)}
                    {t.cons.map((c) => <div key={c} className="small con">{c}</div>)}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside className="stack" style={{ gap: 16 }}>
          {lesson.keyNumbers && (
            <div className="card flat">
              <h3>Key numbers</h3>
              <table className="t">
                <tbody>
                  {lesson.keyNumbers.map((k) => (
                    <tr key={k.label}><td>{k.label}</td><td className="num">{k.value}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {lesson.pitfalls && (
            <div className="card flat">
              <h3>Common pitfalls</h3>
              <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>{lesson.pitfalls.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}
          {lesson.interview && (
            <div className="card flat">
              <h3>In the interview</h3>
              <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>{lesson.interview.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}
          <div className="card" style={{ background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" }}>
            <h3>Practice it</h3>
            <div className="stack">
              {lesson.lab?.map((l) => (
                <Link key={l.href} href={l.href} className="btn accent sm" style={{ justifyContent: "space-between" }}>{l.label} <span>→</span></Link>
              ))}
              {lesson.quizTopic && (
                <Link href={`/practice?tab=quiz&topic=${lesson.quizTopic}`} className="btn ghost sm" style={{ color: "var(--paper)", borderColor: "#6b625a", justifyContent: "space-between" }}>
                  Take the {lesson.title.replace("Case Study: ", "")} quiz <span>→</span>
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>

      <hr />
      <div className="row between">
        {prev ? <Link className="btn ghost" href={`/learn/${prev.slug}`}>← {prev.title}</Link> : <span />}
        {next ? <Link className="btn" href={`/learn/${next.slug}`}>{next.title} →</Link> : <Link className="btn" href="/lab">Open the simulator →</Link>}
      </div>
    </main>
  );
}
