"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Scene from "@/components/three/Scene";
import { api } from "@/lib/api";
import type { Graph } from "@/lib/graph";
import { getUid, load, save } from "@/lib/uid";

type IV = { id: string; title: string; difficulty: string; minutes: number; functional: string[]; non_functional: string[]; estimates: string[]; rubric: string[]; hints: string[] };
type IVFull = IV & { reference: Graph };

const FRAMEWORK = ["Requirements (5 min)", "Estimates (3 min)", "API & data model (7 min)", "High-level design (10 min)", "Deep dives (12 min)", "Bottlenecks & wrap-up (5 min)"];

export default function Interviews({ initialId }: { initialId?: string }) {
  const [list, setList] = useState<IV[]>([]);
  const [cur, setCur] = useState<IVFull | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<IV[]>("/practice/interviews").then(setList).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { if (initialId) open(initialId); }, [initialId]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (id: string) => api<IVFull>(`/practice/interviews/${id}`).then(setCur).catch((e) => setErr(e.message));

  if (cur) return <Session iv={cur} onBack={() => setCur(null)} />;
  return (
    <div className="stack" style={{ gap: 14 }}>
      {err && <div className="err-banner">{err}</div>}
      <div className="card flat">
        <h3>Framework for a 45-minute design interview</h3>
        <ol className="small" style={{ margin: 0, paddingLeft: 18, columns: 2 }}>{FRAMEWORK.map((f) => <li key={f}>{f}</li>)}</ol>
      </div>
      <div className="grid g3">
        {list.map((iv) => (
          <div key={iv.id} className="card link" style={{ cursor: "pointer" }} onClick={() => open(iv.id)}>
            <div className="row between"><span className={`pill ${iv.difficulty}`}>{iv.difficulty}</span><span className="mono tiny muted">{iv.minutes} min</span></div>
            <h3 style={{ marginTop: 10 }}>{iv.title}</h3>
            <p className="small muted" style={{ margin: 0 }}>{iv.functional[0]}…</p>
            <div className="tiny muted" style={{ marginTop: 10 }}>{iv.rubric.length} rubric points · reference design included</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Session({ iv, onBack }: { iv: IVFull; onBack: () => void }) {
  const key = `sf_notes_${iv.id}`;
  const [notes, setNotes] = useState("");
  const [left, setLeft] = useState(iv.minutes * 60);
  const [running, setRunning] = useState(false);
  const [hints, setHints] = useState(0);
  const [checked, setChecked] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; level: string; missed: string[] } | null>(null);
  const [reveal, setReveal] = useState(false);

  useEffect(() => setNotes(load<string>(key, "")), [key]);
  useEffect(() => { save(key, notes); }, [key, notes]);
  useEffect(() => {
    if (!running || left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [running, left]);

  const scene = useMemo(() => ({
    nodes: iv.reference.nodes.map((n) => ({ id: n.id, type: n.type, label: n.label || n.id, pos: [n.x / 75, n.y / 75] as [number, number] })),
    edges: iv.reference.edges.map((e) => ({ from: e.source, to: e.target, rate: 1, color: "#d4603a" })),
  }), [iv]);

  const submit = async () => setResult(await api(`/practice/interviews/${iv.id}/self-assess`, { checked, uid: getUid() }));
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <button className="btn ghost sm" onClick={onBack}>← All prompts</button>
        <div className="row">
          <span className={`timer ${left < 300 ? "" : ""}`} style={{ color: left === 0 ? "var(--red)" : left < 300 ? "var(--terra)" : undefined }}>{mm}:{ss}</span>
          <button className="btn sm" onClick={() => setRunning(!running)}>{running ? "Pause" : left === iv.minutes * 60 ? "Start timer" : "Resume"}</button>
          <button className="btn ghost sm" onClick={() => { setRunning(false); setLeft(iv.minutes * 60); }}>Reset</button>
        </div>
      </div>
      <h2 style={{ margin: 0 }}>{iv.title}</h2>
      <div className="grid g3">
        <div className="card flat"><h3>Functional</h3><ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{iv.functional.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div className="card flat"><h3>Non-functional</h3><ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{iv.non_functional.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div className="card flat"><h3>Scale hints</h3><ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{iv.estimates.map((x) => <li key={x}>{x}</li>)}</ul></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: 16 }}>
        <div className="panel"><div className="panel-h small">Your design notes (saved in this browser)</div><div className="panel-b">
          <textarea style={{ minHeight: 340 }} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder={"1. Requirements & assumptions\n2. Estimates\n3. API\n4. Data model\n5. High-level components\n6. Deep dives\n7. Bottlenecks, failures, trade-offs"} />
          <div className="row" style={{ marginTop: 10 }}>
            {hints < iv.hints.length && <button className="btn ghost sm" onClick={() => setHints(hints + 1)}>Reveal hint ({hints}/{iv.hints.length})</button>}
            <Link className="btn ghost sm" href={`/lab?template=${iv.id}`}>Build it in the simulator →</Link>
          </div>
          {hints > 0 && <ul className="small" style={{ paddingLeft: 18 }}>{iv.hints.slice(0, hints).map((h) => <li key={h}>{h}</li>)}</ul>}
        </div></div>
        <div className="panel"><div className="panel-h small">Self-assessment rubric</div><div className="panel-b stack" style={{ gap: 6 }}>
          {iv.rubric.map((r, i) => (
            <label key={i} className="row small" style={{ flexWrap: "nowrap", alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={checked.includes(i)} onChange={(e) => setChecked(e.target.checked ? [...checked, i] : checked.filter((x) => x !== i))} style={{ marginTop: 3 }} />
              <span>{r}</span>
            </label>
          ))}
          <button className="btn accent sm" onClick={submit} style={{ marginTop: 6 }}>Score my answer</button>
          {result && (
            <div className={`alert ${result.score >= 70 ? "ok" : "warn"} small`}>
              <b>{result.level} · {result.score}%</b>
              {result.missed.length > 0 && <><div style={{ marginTop: 4 }}>Revisit:</div><ul style={{ margin: 0, paddingLeft: 18 }}>{result.missed.map((m) => <li key={m}>{m}</li>)}</ul></>}
            </div>
          )}
        </div></div>
      </div>
      <div className="panel">
        <div className="panel-h small">Reference architecture <span className="spacer" />
          <button className="btn ghost sm" onClick={() => setReveal(!reveal)}>{reveal ? "Hide" : "Reveal (try first!)"}</button>
        </div>
        {reveal && <div style={{ height: 440 }}><Scene nodes={scene.nodes} edges={scene.edges} padding={3} /></div>}
      </div>
    </div>
  );
}
