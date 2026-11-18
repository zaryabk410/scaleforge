"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type NodeV = { id: string; state: "follower" | "candidate" | "leader" | "dead"; term: number; voted_for: string | null; log: number[]; commit: number; timeout: number };
type Frame = { t: number; nodes: NodeV[]; msgs: { from: string; to: string; kind: string; p: number; blocked: boolean }[]; partition: string[][] | null };
type RaftRes = { nodes: string[]; frames: Frame[]; log: { t: number; msg: string; kind: string }[]; stats: { elections: number; leaders: { t: number; id: string; term: number }[]; messages: number; committed: number } };
type Ev = { at: number; type: "kill" | "revive" | "partition" | "heal" | "client"; node?: string; count?: number };

const STATE_COL: Record<string, string> = { follower: "#7d7366", candidate: "#dca22c", leader: "#d4603a", dead: "#c7b9a5" };
const MSG_COL: Record<string, string> = { RequestVote: "#dca22c", Vote: "#2c7c77", AppendEntries: "#3a6fb0", AppendResp: "#7a5ca6" };
const TERM_COL = ["#a89a86", "#d4603a", "#2c7c77", "#7a5ca6", "#dca22c", "#3a6fb0", "#c4402e", "#3f8a4f", "#9a6bb8", "#b5822a"];

const PRESETS: Record<string, Ev[]> = {
  "Leader crash + recovery": [{ at: 1200, type: "kill" }, { at: 2400, type: "revive", node: "N1" }],
  "Network partition": [{ at: 1000, type: "partition" }, { at: 2000, type: "client", count: 3 }, { at: 3000, type: "heal" }],
  "Cascading failures": [{ at: 900, type: "kill" }, { at: 1800, type: "kill" }, { at: 2700, type: "kill" }, { at: 3400, type: "revive", node: "N1" }],
  "Full tour": [{ at: 1200, type: "kill" }, { at: 2200, type: "revive", node: "N1" }, { at: 2600, type: "partition" }, { at: 3400, type: "heal" }],
};

export default function RaftLab() {
  const [n, setN] = useState(5);
  const [lat, setLat] = useState<[number, number]>([5, 25]);
  const [clientEvery, setClientEvery] = useState(300);
  const [duration, setDuration] = useState(4000);
  const [events, setEvents] = useState<Ev[]>(PRESETS["Full tour"]);
  const [seed, setSeed] = useState(3);
  const [res, setRes] = useState<RaftRes | null>(null);
  const [fi, setFi] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [err, setErr] = useState("");

  const run = () => {
    setErr("");
    api<RaftRes>("/labs/raft", { n, duration, latency_min: lat[0], latency_max: lat[1], client_interval: clientEvery, events, seed })
      .then((r) => { setRes(r); setFi(0); setPlaying(true); })
      .catch((e) => setErr(e.message));
  };
  useEffect(run, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing || !res) return;
    if (fi >= res.frames.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setFi((x) => x + 1), 60 / speed);
    return () => clearTimeout(t);
  }, [playing, fi, res, speed]);

  const frame = res?.frames[fi];
  const pos = useMemo(() => {
    const m: Record<string, [number, number]> = {};
    res?.nodes.forEach((id, i) => {
      const a = (i / res.nodes.length) * 2 * Math.PI - Math.PI / 2;
      m[id] = [230 + 160 * Math.cos(a), 200 + 160 * Math.sin(a)];
    });
    return m;
  }, [res]);
  const visibleLog = res ? res.log.filter((l) => l.t <= (frame?.t ?? 0)).slice(-60).reverse() : [];

  const addEv = (e: Ev) => setEvents([...events, e].sort((a, b) => a.at - b.at));

  return (
    <div className="grid" style={{ gridTemplateColumns: "320px minmax(0, 1fr)", gap: 18 }}>
      <div className="stack">
        <div className="panel"><div className="panel-h">Cluster</div><div className="panel-b stack">
          <label className="field">Nodes: {n}<input type="range" min={3} max={9} value={n} onChange={(e) => setN(Number(e.target.value))} /></label>
          <label className="field">Network latency {lat[0]}–{lat[1]} ms
            <input type="range" min={1} max={150} value={lat[1]} onChange={(e) => setLat([Math.min(lat[0], Number(e.target.value)), Number(e.target.value)])} />
          </label>
          <label className="field">Client write every (ms, 0 = off)<input type="number" value={clientEvery} onChange={(e) => setClientEvery(Number(e.target.value))} /></label>
          <label className="field">Duration (ms)<input type="number" value={duration} step={500} onChange={(e) => setDuration(Number(e.target.value))} /></label>
          <label className="field">Random seed<input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} /></label>
          <p className="tiny muted">Push latency above ~120 ms (close to the 150–300 ms election timeout) to provoke split votes and repeated elections.</p>
        </div></div>
        <div className="panel"><div className="panel-h">Fault script</div><div className="panel-b stack">
          <select value="" onChange={(e) => e.target.value && setEvents(PRESETS[e.target.value])}>
            <option value="">Load preset…</option>
            {Object.keys(PRESETS).map((p) => <option key={p}>{p}</option>)}
          </select>
          {events.map((e, i) => (
            <div key={i} className="row small" style={{ flexWrap: "nowrap" }}>
              <input type="number" value={e.at} style={{ width: 80 }} onChange={(ev) => setEvents(events.map((x, k) => k === i ? { ...x, at: Number(ev.target.value) } : x))} />
              <span style={{ flex: 1 }}>ms · <b>{e.type}</b>{e.type === "kill" ? (e.node ? ` ${e.node}` : " leader") : e.node ? ` ${e.node}` : ""}{e.type === "client" ? ` ×${e.count || 1}` : ""}</span>
              <button className="btn ghost sm" onClick={() => setEvents(events.filter((_, k) => k !== i))}>✕</button>
            </div>
          ))}
          <div className="row">
            <button className="btn ghost sm" onClick={() => addEv({ at: 1500, type: "kill" })}>+ kill leader</button>
            <button className="btn ghost sm" onClick={() => addEv({ at: 2500, type: "revive", node: "N1" })}>+ revive N1</button>
            <button className="btn ghost sm" onClick={() => addEv({ at: 2000, type: "partition" })}>+ partition</button>
            <button className="btn ghost sm" onClick={() => addEv({ at: 3000, type: "heal" })}>+ heal</button>
            <button className="btn ghost sm" onClick={() => addEv({ at: 1000, type: "client", count: 5 })}>+ 5 writes</button>
          </div>
          <button className="btn" onClick={run}>Run simulation</button>
          {err && <div className="err-banner">{err}</div>}
        </div></div>
      </div>

      {res && frame && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="grid g4" style={{ gap: 10 }}>
            <div className="kpi"><div className="l">Time</div><div className="v">{frame.t} ms</div></div>
            <div className="kpi"><div className="l">Elections</div><div className="v">{res.stats.elections}</div></div>
            <div className="kpi"><div className="l">Leaders elected</div><div className="v">{res.stats.leaders.length}</div></div>
            <div className="kpi good"><div className="l">Committed entries</div><div className="v">{res.stats.committed}</div></div>
          </div>
          <div className="panel"><div className="panel-b scrub">
            <button className="btn sm" onClick={() => { if (fi >= res.frames.length - 1) setFi(0); setPlaying(!playing); }}>{playing ? "❚❚" : "▶"}</button>
            <input type="range" min={0} max={res.frames.length - 1} value={fi} onChange={(e) => { setPlaying(false); setFi(Number(e.target.value)); }} />
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} style={{ width: 80 }}>
              {[0.25, 0.5, 1, 2, 4].map((s) => <option key={s} value={s}>{s}×</option>)}
            </select>
          </div></div>
          <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 14 }}>
            <div className="panel"><div className="panel-h small">Cluster{frame.partition && <span className="pill bad">partitioned</span>}</div><div className="panel-b center">
              <svg viewBox="0 0 460 400" style={{ width: "100%" }}>
                {res.nodes.map((a, i) => res.nodes.slice(i + 1).map((b) => (
                  <line key={a + b} x1={pos[a][0]} y1={pos[a][1]} x2={pos[b][0]} y2={pos[b][1]} stroke="#e4d9c8" strokeWidth={1} />
                )))}
                {frame.msgs.map((m, i) => {
                  const [x1, y1] = pos[m.from], [x2, y2] = pos[m.to];
                  const p = Math.max(0, Math.min(1, m.p));
                  return <circle key={i} cx={x1 + (x2 - x1) * p} cy={y1 + (y2 - y1) * p} r={m.kind === "AppendEntries" ? 4 : 5}
                    fill={m.blocked ? "#c4402e" : MSG_COL[m.kind]} opacity={m.blocked ? 0.5 : 0.95} />;
                })}
                {frame.nodes.map((nd) => {
                  const [x, y] = pos[nd.id];
                  const inMinority = frame.partition && frame.partition[0]?.includes(nd.id);
                  return (
                    <g key={nd.id} className="raft-node">
                      {nd.state !== "leader" && nd.state !== "dead" && (
                        <circle cx={x} cy={y} r={36} fill="none" stroke="#e4d9c8" strokeWidth={4}
                          strokeDasharray={`${Math.min(1, nd.timeout / 300) * 226} 226`} transform={`rotate(-90 ${x} ${y})`} />
                      )}
                      <circle cx={x} cy={y} r={30} fill={nd.state === "dead" ? "#ebe2d5" : "#fffdf9"} stroke={STATE_COL[nd.state]} strokeWidth={nd.state === "leader" ? 5 : 3}
                        strokeDasharray={inMinority ? "5 3" : undefined} />
                      <text x={x} y={y - 4} textAnchor="middle" fontSize={14} fontWeight={700} fill={nd.state === "dead" ? "#a89a86" : "#1f1b16"}>{nd.id}</text>
                      <text x={x} y={y + 12} textAnchor="middle" fontSize={8} fill={STATE_COL[nd.state]} fontWeight={700}>{nd.state === "dead" ? "CRASHED" : nd.state.toUpperCase()}</text>
                      <text x={x} y={y + 48} textAnchor="middle" fontSize={10} fill="#7d7366">term {nd.term}</text>
                    </g>
                  );
                })}
              </svg>
              <div className="legend-row" style={{ justifyContent: "center" }}>
                {Object.entries(MSG_COL).map(([k, c]) => <span key={k}><i style={{ background: c, height: 8, width: 8, borderRadius: 4 }} />{k}</span>)}
                <span><i style={{ background: "#c4402e", height: 8, width: 8, borderRadius: 4 }} />dropped by partition</span>
              </div>
            </div></div>
            <div className="stack">
              <div className="panel"><div className="panel-h small">Logs (color = term, ▮ committed)</div><div className="panel-b stack" style={{ gap: 6 }}>
                {frame.nodes.map((nd) => (
                  <div key={nd.id} className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                    <b className="mono small" style={{ width: 26, color: STATE_COL[nd.state] }}>{nd.id}</b>
                    <div style={{ display: "flex", flexWrap: "wrap", opacity: nd.state === "dead" ? 0.4 : 1 }}>
                      {nd.log.slice(-18).map((term, k, arr) => {
                        const idx = nd.log.length - arr.length + k + 1;
                        return <span key={k} className="log-cell" style={{ background: TERM_COL[term % TERM_COL.length], outline: idx <= nd.commit ? "2px solid #1f1b16" : "none", opacity: idx <= nd.commit ? 1 : 0.55 }}>{term}</span>;
                      })}
                    </div>
                    <span className="tiny muted" style={{ marginLeft: "auto" }}>c={nd.commit}</span>
                  </div>
                ))}
              </div></div>
              <div className="panel"><div className="panel-h small">Event log</div>
                <div className="panel-b event-log">
                  {visibleLog.map((l, i) => (
                    <div key={i} style={{ color: l.kind === "leader" ? "#d4603a" : l.kind === "fault" ? "#c4402e" : l.kind === "commit" ? "#3f8a4f" : l.kind === "warn" ? "#b5822a" : undefined }}>
                      <span className="muted">{String(l.t).padStart(4, " ")}ms</span> {l.msg}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
