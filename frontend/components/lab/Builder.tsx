"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Canvas, { edgeId } from "./Canvas";
import Inspector from "./Inspector";
import Results, { type GradeResult, type SimResult } from "./Results";
import Scene, { type SceneEdgeView, type SceneNodeView } from "@/components/three/Scene";
import { api } from "@/lib/api";
import { DEFAULT_TRAFFIC, EMPTY_GRAPH, makeNode, toSpec, type Graph, type LabNode, type Traffic } from "@/lib/graph";
import { KINDS, KIND_ORDER, type NodeKind } from "@/lib/kinds";
import { getUid, load, save } from "@/lib/uid";

type Scenario = {
  id: string; title: string; difficulty: string; story: string; traffic: Partial<Traffic>;
  chaos: { node_type: string; at: number; replicas?: number; recover_at?: number }[];
  criteria: Record<string, number | boolean>; hints: string[]; starter: Graph;
};

const TEMPLATES = [
  ["url-shortener", "URL shortener"], ["news-feed", "News feed"], ["chat-system", "Chat system"], ["video-streaming", "Video platform"],
  ["rate-limiter", "Rate limiter"], ["ride-sharing", "Ride sharing"], ["notification-system", "Notifications"],
];

function criteriaText(c: Scenario["criteria"]) {
  const out: string[] = [];
  if (c.p99_max) out.push(`p99 ≤ ${c.p99_max} ms`);
  if (c.error_rate_max !== undefined) out.push(`errors ≤ ${(Number(c.error_rate_max) * 100).toFixed(2)}%`);
  if (c.cost_max) out.push(`cost ≤ $${Number(c.cost_max).toLocaleString()}/mo`);
  if (c.backlog_max !== undefined) out.push(`final backlog ≤ ${Number(c.backlog_max).toLocaleString()}`);
  if (c.async_failures_max !== undefined) out.push(`no async write failures`);
  if (c.no_spof) out.push("no single point of failure");
  if (c.no_queue) out.push("synchronous writes (no queue)");
  return out;
}

export default function Builder() {
  const params = useSearchParams();
  const [graph, setGraph] = useState<Graph>(EMPTY_GRAPH);
  const [traffic, setTraffic] = useState<Traffic>(DEFAULT_TRAFFIC);
  const [sel, setSel] = useState<{ kind: "node" | "edge"; id: string } | null>(null);
  const [res, setRes] = useState<SimResult | null>(null);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [hints, setHints] = useState(0);
  const [designs, setDesigns] = useState<{ name: string; graph: Graph & { traffic?: Traffic } }[]>([]);
  const [saveName, setSaveName] = useState("");
  const history = useRef<Graph[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const push = useCallback((g: Graph) => {
    history.current = [...history.current.slice(-40), graph];
    setGraph(g);
  }, [graph]);

  const undo = () => {
    const prev = history.current.pop();
    if (prev) setGraph(prev);
  };

  // boot: restore autosave, then apply query params
  useEffect(() => {
    const saved = load<{ graph: Graph; traffic: Traffic } | null>("sf_lab", null);
    if (saved?.graph?.nodes) {
      setGraph(saved.graph);
      setTraffic({ ...DEFAULT_TRAFFIC, ...saved.traffic });
    }
    api<Scenario[]>("/scenarios").then((s) => {
      setScenarios(s);
      const ch = params.get("challenge");
      if (ch) {
        const sc = s.find((x) => x.id === ch);
        if (sc) startScenario(sc);
      }
    }).catch((e) => setErr(e.message));
    const tpl = params.get("template");
    if (tpl) loadTemplate(tpl);
    refreshDesigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { save("sf_lab", { graph, traffic }); }, [graph, traffic]);

  useEffect(() => {
    if (!playing || !res) return;
    if (tick >= res.timeline.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setTick((x) => x + 1), 110);
    return () => clearTimeout(t);
  }, [playing, tick, res]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); removeSelected(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function refreshDesigns() {
    const uid = getUid();
    api<typeof designs>(`/designs/${uid}`).then(setDesigns).catch(() => {});
  }

  function startScenario(sc: Scenario) {
    setScenario(sc);
    setHints(0);
    setGrade(null);
    setRes(null);
    setGraph(JSON.parse(JSON.stringify(sc.starter)));
    setTraffic({ ...DEFAULT_TRAFFIC, ...sc.traffic });
    setSel(null);
  }

  async function loadTemplate(id: string) {
    try {
      const iv = await api<{ reference: Graph; traffic: Traffic; title: string }>(`/practice/interviews/${id}`);
      setScenario(null);
      setGraph(iv.reference);
      setTraffic({ ...DEFAULT_TRAFFIC, ...iv.traffic });
      setRes(null);
      setGrade(null);
    } catch (e: any) { setErr(e.message); }
  }

  const removeSelected = () => {
    if (!sel) return;
    if (sel.kind === "node") {
      push({ nodes: graph.nodes.filter((n) => n.id !== sel.id), edges: graph.edges.filter((e) => e.source !== sel.id && e.target !== sel.id) });
    } else {
      push({ ...graph, edges: graph.edges.filter((e) => edgeId(e) !== sel.id) });
    }
    setSel(null);
  };

  const addNode = (kind: NodeKind, x?: number, y?: number) => {
    const n = makeNode(kind, x ?? 200 + Math.random() * 500, y ?? 80 + Math.random() * 400, graph.nodes);
    push({ ...graph, nodes: [...graph.nodes, n] });
    setSel({ kind: "node", id: n.id });
  };

  const patchNode = (id: string, patch: Partial<LabNode>) => {
    push({ ...graph, nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  };

  async function run(gradeIt = false) {
    setBusy(true);
    setErr(null);
    try {
      if (gradeIt && scenario) {
        const g = await api<GradeResult & { result: SimResult; findings: SimResult["findings"] }>(`/scenarios/${scenario.id}/grade`, {
          nodes: toSpec(graph.nodes), edges: graph.edges, uid: getUid(),
        });
        setGrade({ passed: g.passed, score: g.score, checks: g.checks });
        setRes({ ...g.result, findings: g.findings });
        setTick(g.result.timeline.length - 1);
      } else {
        const r = await api<SimResult>("/sim/run", {
          nodes: toSpec(graph.nodes), edges: graph.edges, traffic: { ...traffic, seed: 42 },
          chaos: scenario?.chaos || [],
        });
        setGrade(null);
        setRes(r);
        setTick(r.timeline.length - 1);
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveDesign() {
    const name = saveName.trim();
    if (!name) return;
    try {
      await api("/designs", { uid: getUid(), name, graph: { ...graph, traffic } });
      setSaveName("");
      refreshDesigns();
    } catch (e: any) { setErr(e.message); }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ ...graph, traffic }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "scaleforge-design.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJson(f: File) {
    f.text().then((t) => {
      try {
        const j = JSON.parse(t);
        if (!Array.isArray(j.nodes) || !Array.isArray(j.edges)) throw new Error("JSON must contain nodes[] and edges[]");
        push({ nodes: j.nodes, edges: j.edges });
        if (j.traffic) setTraffic({ ...DEFAULT_TRAFFIC, ...j.traffic });
      } catch (e: any) { setErr("Import failed: " + e.message); }
    });
  }

  const frame = res?.timeline[Math.min(tick, (res?.timeline.length || 1) - 1)];
  const selNode = sel?.kind === "node" ? graph.nodes.find((n) => n.id === sel.id) : undefined;
  const selEdge = sel?.kind === "edge" ? graph.edges.find((e) => edgeId(e) === sel.id) : undefined;
  const locked = !!scenario;

  const scene3d = useMemo(() => {
    const nodes: SceneNodeView[] = graph.nodes.map((n) => {
      const u = frame?.util[n.id];
      const down = frame?.down.includes(n.id);
      return {
        id: n.id, type: n.type, label: n.label || n.id, pos: [n.x / 75, n.y / 75],
        state: down ? "down" : u !== undefined && u >= 0.95 ? "hot" : "normal",
        badge: u !== undefined && n.type !== "client" ? (down ? "DOWN" : u >= 999 ? "∞" : `${Math.round(u * 100)}%`) : undefined,
      };
    });
    const edges: SceneEdgeView[] = graph.edges.map((e) => {
      const u = frame?.util[e.target];
      const down = frame?.down.includes(e.target);
      return {
        from: e.source, to: e.target,
        color: down || (u !== undefined && u >= 1) ? "#c4402e" : KINDS[graph.nodes.find((n) => n.id === e.target)?.type || "server"].color,
        rate: down ? 0.4 : u === undefined ? 1 : Math.min(3, 0.4 + Math.min(u, 1.5) * 1.8),
      };
    });
    return { nodes, edges };
  }, [graph, frame]);

  return (
    <div>
      <div className="toolbar">
        <select value={scenario?.id || ""} onChange={(e) => {
          const sc = scenarios.find((s) => s.id === e.target.value);
          if (sc) startScenario(sc); else { setScenario(null); setGrade(null); }
        }} style={{ width: 240 }}>
          <option value="">Free build (no challenge)</option>
          {scenarios.map((s) => <option key={s.id} value={s.id}>{s.title} · {s.difficulty}</option>)}
        </select>
        <select value="" onChange={(e) => e.target.value && loadTemplate(e.target.value)} style={{ width: 200 }}>
          <option value="">Load reference design…</option>
          {TEMPLATES.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
        </select>
        <div className="spacer" />
        <div className="tabs">
          <button className={view === "2d" ? "on" : ""} onClick={() => setView("2d")}>2D editor</button>
          <button className={view === "3d" ? "on" : ""} onClick={() => setView("3d")}>3D view</button>
        </div>
        <button className="btn ghost sm" onClick={undo} disabled={!history.current.length}>Undo</button>
        <button className="btn ghost sm" onClick={() => { push({ nodes: [], edges: [] }); setRes(null); }}>Clear</button>
        <button className="btn ghost sm" onClick={exportJson}>Export</button>
        <button className="btn ghost sm" onClick={() => fileRef.current?.click()}>Import</button>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
      </div>

      {scenario && (
        <div className="card flat" style={{ marginBottom: 14, padding: 16 }}>
          <div className="row between">
            <div className="row"><span className="eyebrow">Challenge</span><h3 style={{ margin: 0 }}>{scenario.title}</h3><span className={`pill ${scenario.difficulty}`}>{scenario.difficulty}</span></div>
            <div className="row">
              {hints < scenario.hints.length && <button className="btn ghost sm" onClick={() => setHints(hints + 1)}>Hint ({hints}/{scenario.hints.length})</button>}
              <button className="btn ghost sm" onClick={() => startScenario(scenario)}>Reset to starter</button>
            </div>
          </div>
          <p className="small" style={{ margin: "8px 0" }}>{scenario.story}</p>
          <div className="row small">
            <b>Pass if:</b>{criteriaText(scenario.criteria).map((c) => <span key={c} className="pill">{c}</span>)}
            {scenario.chaos.length > 0 && <span className="pill bad">chaos: {scenario.chaos.map((c) => `${c.node_type}@${c.at}s`).join(", ")}</span>}
          </div>
          {hints > 0 && <ul className="small" style={{ margin: "8px 0 0", paddingLeft: 18 }}>{scenario.hints.slice(0, hints).map((h) => <li key={h}>{h}</li>)}</ul>}
        </div>
      )}

      <div className="lab">
        <div className="stack">
          <div className="panel">
            <div className="panel-h small">Components</div>
            <div className="panel-b palette">
              {KIND_ORDER.map((k) => (
                <button key={k} draggable onDragStart={(e) => e.dataTransfer.setData("text/kind", k)} onClick={() => addNode(k)} title={KINDS[k].desc}>
                  <span className="dot" style={{ background: KINDS[k].color }} /> {KINDS[k].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="stack" style={{ minWidth: 0 }}>
          {view === "2d" ? (
            <Canvas
              nodes={graph.nodes} edges={graph.edges} virtualEdges={res?.virtual_edges} selected={sel}
              util={frame?.util} replicasNow={frame?.replicas} down={frame?.down}
              onSelect={setSel}
              onMove={(id, x, y) => setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) }))}
              onMoveEnd={() => {}}
              onConnect={(a, b) => {
                if (a === b || graph.edges.some((e) => e.source === a && e.target === b)) return;
                push({ ...graph, edges: [...graph.edges, { source: a, target: b }] });
              }}
              onDropKind={(k, x, y) => addNode(k, x, y)}
            />
          ) : (
            <div className="overlay-3d">
              <div className="legend"><span>{frame ? `t = ${tick}s · ${Math.round(frame.rps).toLocaleString()} req/s` : "Run the simulation to see live load"}</span></div>
              <Scene nodes={scene3d.nodes} edges={scene3d.edges} padding={3} />
            </div>
          )}

          <div className="panel">
            <div className="panel-h small">
              Traffic {locked && <span className="pill">set by challenge</span>}
              <span className="spacer" />
              <button className="btn sm" onClick={() => run(false)} disabled={busy}>{busy ? "Simulating…" : "▶ Run simulation"}</button>
              {scenario && <button className="btn accent sm" onClick={() => run(true)} disabled={busy}>Submit for grading</button>}
            </div>
            <div className="panel-b traffic">
              <label className="field">Requests/s<input type="number" min={1} value={traffic.rps} disabled={locked} onChange={(e) => setTraffic({ ...traffic, rps: Number(e.target.value) || 1 })} /></label>
              <label className="field">Read ratio {Math.round(traffic.read_ratio * 100)}%<input type="range" min={0} max={1} step={0.01} disabled={locked} value={traffic.read_ratio} onChange={(e) => setTraffic({ ...traffic, read_ratio: Number(e.target.value) })} /></label>
              <label className="field">Duration (s)<input type="number" min={10} max={600} value={traffic.duration} disabled={locked} onChange={(e) => setTraffic({ ...traffic, duration: Math.max(10, Number(e.target.value) || 10) })} /></label>
              <label className="field">Pattern
                <select value={traffic.pattern} disabled={locked} onChange={(e) => setTraffic({ ...traffic, pattern: e.target.value as Traffic["pattern"] })}>
                  <option value="steady">Steady</option><option value="spike">Spike</option><option value="ramp">Ramp</option><option value="diurnal">Diurnal</option>
                </select>
              </label>
              {traffic.pattern !== "steady" && (
                <>
                  <label className="field">Peak ×<input type="number" min={1} max={50} step={0.1} value={traffic.spike_multiplier} disabled={locked} onChange={(e) => setTraffic({ ...traffic, spike_multiplier: Number(e.target.value) || 1 })} /></label>
                  {traffic.pattern === "spike" && (
                    <>
                      <label className="field">Spike at (s)<input type="number" min={0} value={traffic.spike_at} disabled={locked} onChange={(e) => setTraffic({ ...traffic, spike_at: Number(e.target.value) || 0 })} /></label>
                      <label className="field">Spike length (s)<input type="number" min={1} value={traffic.spike_duration} disabled={locked} onChange={(e) => setTraffic({ ...traffic, spike_duration: Number(e.target.value) || 1 })} /></label>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          {err && <div className="err-banner">{err}</div>}
        </div>

        <div className="stack">
          <Inspector node={selNode} edge={selEdge} nodes={graph.nodes}
            onChange={(p) => selNode && patchNode(selNode.id, p)} onDelete={removeSelected}
            stats={selNode && res ? res.nodes[selNode.id] : undefined} />
          <div className="panel">
            <div className="panel-h small">My designs</div>
            <div className="panel-b stack" style={{ gap: 8 }}>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input type="text" placeholder="Design name" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
                <button className="btn sm" onClick={saveDesign} disabled={!saveName.trim()}>Save</button>
              </div>
              {designs.length === 0 && <span className="tiny muted">Saved designs appear here (stored by the backend).</span>}
              {designs.map((d) => (
                <div key={d.name} className="row between small">
                  <a href="#" onClick={(e) => {
                    e.preventDefault();
                    push({ nodes: d.graph.nodes, edges: d.graph.edges });
                    if (d.graph.traffic && !locked) setTraffic({ ...DEFAULT_TRAFFIC, ...d.graph.traffic });
                  }}>{d.name}</a>
                  <button className="btn ghost sm" onClick={() => api(`/designs/${getUid()}/${encodeURIComponent(d.name)}`, undefined, "DELETE").then(refreshDesigns)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {res && (
        <div style={{ marginTop: 20 }}>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-b scrub">
              <button className="btn sm" onClick={() => { if (tick >= res.timeline.length - 1) setTick(0); setPlaying(!playing); }}>{playing ? "❚❚ Pause" : "▶ Replay"}</button>
              <input type="range" min={0} max={res.timeline.length - 1} value={tick} onChange={(e) => { setPlaying(false); setTick(Number(e.target.value)); }} />
              <span className="mono small" style={{ whiteSpace: "nowrap" }}>t={tick}s · {Math.round(frame?.rps || 0).toLocaleString()} rps · p99 {frame?.p99} ms</span>
            </div>
          </div>
          <Results res={res} tick={tick} grade={grade} onFocusNode={(id) => setSel({ kind: "node", id })} />
        </div>
      )}
    </div>
  );
}
