"use client";

import { useEffect, useState } from "react";
import { BarChart } from "@/components/charts/Charts";
import { api } from "@/lib/api";

const PALETTE = ["#d4603a", "#2c7c77", "#7a5ca6", "#dca22c", "#3a6fb0", "#c4402e", "#3f8a4f", "#9a6bb8", "#b5822a", "#557a3c"];
const colorOf = (nodes: string[], n: string) => PALETTE[Math.max(0, nodes.indexOf(n)) % PALETTE.length];

type CH = {
  ring: { pos: number; node: string }[]; distribution_before: Record<string, number>; distribution_after: Record<string, number>;
  imbalance_cv_before: number; imbalance_cv_after: number; moved_pct: number; modulo_moved_pct: number; ideal_moved_pct: number;
  keys_sample: { key: string; pos: number; node: string; moved: boolean }[]; nodes_after: string[];
};

export function HashRingLab() {
  const [nodes, setNodes] = useState(["A", "B", "C", "D"]);
  const [vnodes, setVnodes] = useState(8);
  const [keys, setKeys] = useState(5000);
  const [action, setAction] = useState<"none" | "add" | "remove">("add");
  const [target, setTarget] = useState("E");
  const [res, setRes] = useState<CH | null>(null);
  const [err, setErr] = useState("");

  const run = () => {
    setErr("");
    api<CH>("/labs/consistent-hashing", {
      nodes, vnodes, num_keys: keys,
      add: action === "add" ? target : null, remove: action === "remove" ? target : null,
    }).then(setRes).catch((e) => setErr(e.message));
  };
  useEffect(run, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allNodes = res ? Array.from(new Set([...nodes, ...res.nodes_after])) : nodes;
  const R = 150, cx = 180, cy = 180;
  const at = (p: number, r: number) => [cx + r * Math.sin(p * 2 * Math.PI), cy - r * Math.cos(p * 2 * Math.PI)];

  return (
    <div className="grid" style={{ gridTemplateColumns: "300px minmax(0, 1fr)", gap: 18 }}>
      <div className="panel"><div className="panel-h">Ring setup</div><div className="panel-b stack">
        <label className="field">Nodes (comma separated)<input type="text" value={nodes.join(",")} onChange={(e) => setNodes(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></label>
        <label className="field">Virtual nodes per node: {vnodes}<input type="range" min={1} max={200} value={vnodes} onChange={(e) => setVnodes(Number(e.target.value))} /></label>
        <label className="field">Keys<input type="number" value={keys} min={100} max={100000} onChange={(e) => setKeys(Number(e.target.value))} /></label>
        <label className="field">Change
          <select value={action} onChange={(e) => setAction(e.target.value as typeof action)}>
            <option value="none">No change</option><option value="add">Add node</option><option value="remove">Remove node</option>
          </select>
        </label>
        {action !== "none" && <label className="field">{action === "add" ? "New node name" : "Node to remove"}<input type="text" value={target} onChange={(e) => setTarget(e.target.value.trim())} /></label>}
        <button className="btn" onClick={run}>Rehash</button>
        {err && <div className="err-banner">{err}</div>}
        <p className="tiny muted">Try 1 vnode vs 150 vnodes and compare imbalance, then add a node and compare keys moved against modulo hashing.</p>
      </div></div>

      {res && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid g4" style={{ gap: 10 }}>
            <div className="kpi good"><div className="l">Keys moved (ring)</div><div className="v">{res.moved_pct}%</div><div className="tiny muted">ideal ≈ {res.ideal_moved_pct}%</div></div>
            <div className="kpi bad"><div className="l">Keys moved (mod N)</div><div className="v">{res.modulo_moved_pct}%</div></div>
            <div className="kpi"><div className="l">Imbalance before</div><div className="v">{res.imbalance_cv_before}%</div><div className="tiny muted">coefficient of variation</div></div>
            <div className="kpi"><div className="l">Imbalance after</div><div className="v">{res.imbalance_cv_after}%</div></div>
          </div>
          <div className="grid g2">
            <div className="panel"><div className="panel-h small">Hash ring (after change) · dots = keys, ringed = moved</div><div className="panel-b center">
              <svg viewBox="0 0 360 360" style={{ width: "100%", maxWidth: 380 }}>
                <circle cx={cx} cy={cy} r={R} fill="none" stroke="#d9cebe" strokeWidth={10} />
                {res.ring.map((p, i) => {
                  const [x1, y1] = at(p.pos, R - 12), [x2, y2] = at(p.pos, R + 12);
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={colorOf(allNodes, p.node)} strokeWidth={vnodes > 60 ? 1 : 3} />;
                })}
                {res.keys_sample.map((k) => {
                  const [x, y] = at(k.pos, R - 30);
                  return <circle key={k.key} cx={x} cy={y} r={k.moved ? 4 : 2.6} fill={colorOf(allNodes, k.node)} stroke={k.moved ? "#1f1b16" : "none"} strokeWidth={1.2} />;
                })}
                <text x={cx} y={cy - 6} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1f1b16">2³² ring</text>
                <text x={cx} y={cy + 12} textAnchor="middle" fontSize={11} fill="#7d7366">{res.ring.length} tokens</text>
              </svg>
              <div className="legend-row" style={{ justifyContent: "center" }}>
                {res.nodes_after.map((n) => <span key={n}><i style={{ background: colorOf(allNodes, n), height: 8 }} />{n}</span>)}
              </div>
            </div></div>
            <div className="panel"><div className="panel-h small">Keys per node</div><div className="panel-b">
              <div className="small muted">Before</div>
              <BarChart height={130} bars={Object.entries(res.distribution_before).map(([n, v]) => ({ label: n, value: v, color: colorOf(allNodes, n) }))}
                refLine={keys / Object.keys(res.distribution_before).length} />
              <div className="small muted">After</div>
              <BarChart height={130} bars={Object.entries(res.distribution_after).map(([n, v]) => ({ label: n, value: v, color: colorOf(allNodes, n) }))}
                refLine={keys / Object.keys(res.distribution_after).length} />
              <div className="tiny muted">Dashed line = perfectly even share.</div>
            </div></div>
          </div>
        </div>
      )}
    </div>
  );
}

type SH = { counts: number[]; load_pct: number[]; hottest_shard: number; hotspot_factor: number; storage_cv: number; verdict: string };

export function ShardingLab() {
  const [strategy, setStrategy] = useState("range");
  const [shards, setShards] = useState(6);
  const [pattern, setPattern] = useState("sequential");
  const [skew, setSkew] = useState(1.0);
  const [res, setRes] = useState<SH | null>(null);
  const [est, setEst] = useState({ write_qps: 20000, read_qps: 120000, storage_tb: 18 });
  const [estRes, setEstRes] = useState<{ needed: Record<string, number>; shards: number; with_headroom: number } | null>(null);
  const [err, setErr] = useState("");

  const run = () => api<SH>("/labs/sharding", { strategy, shards, key_pattern: pattern, access_skew: skew, num_keys: 8000 }).then(setRes).catch((e) => setErr(e.message));
  useEffect(() => { run(); }, [strategy, shards, pattern, skew]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid" style={{ gridTemplateColumns: "300px minmax(0, 1fr)", gap: 18 }}>
      <div className="stack">
        <div className="panel"><div className="panel-h">Strategy</div><div className="panel-b stack">
          <label className="field">Placement
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
              <option value="range">Range</option><option value="hash">Hash (mod N)</option><option value="consistent">Consistent hash</option><option value="directory">Directory / lookup</option>
            </select>
          </label>
          <label className="field">Shards: {shards}<input type="range" min={2} max={16} value={shards} onChange={(e) => setShards(Number(e.target.value))} /></label>
          <label className="field">Key pattern
            <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
              <option value="sequential">Sequential (auto-increment / timestamp)</option><option value="uniform">Uniform random</option><option value="skewed">Skewed key space</option>
            </select>
          </label>
          <label className="field">Access skew (zipf α): {skew.toFixed(1)}<input type="range" min={0} max={2} step={0.1} value={skew} onChange={(e) => setSkew(Number(e.target.value))} /></label>
          <p className="tiny muted">With sequential keys, newest records are the most accessed. Watch what range sharding does to the last shard.</p>
        </div></div>
        <div className="panel"><div className="panel-h">How many shards?</div><div className="panel-b stack">
          <label className="field">Write QPS<input type="number" value={est.write_qps} onChange={(e) => setEst({ ...est, write_qps: Number(e.target.value) })} /></label>
          <label className="field">Read QPS<input type="number" value={est.read_qps} onChange={(e) => setEst({ ...est, read_qps: Number(e.target.value) })} /></label>
          <label className="field">Storage (TB)<input type="number" value={est.storage_tb} onChange={(e) => setEst({ ...est, storage_tb: Number(e.target.value) })} /></label>
          <button className="btn sm" onClick={() => api("/labs/shard-estimate", est).then(setEstRes)}>Estimate</button>
          {estRes && (
            <div className="small">
              Writes need <b>{estRes.needed.writes}</b>, reads <b>{estRes.needed.reads}</b>, storage <b>{estRes.needed.storage}</b> →{" "}
              <b>{estRes.shards}</b> shards, <b>{estRes.with_headroom}</b> with 50% headroom.
              <div className="tiny muted">Assumes 1.5k writes/s, 6k reads/s, 2 TB per shard.</div>
            </div>
          )}
        </div></div>
      </div>
      {res && (
        <div className="stack" style={{ gap: 16 }}>
          <div className={`alert ${res.hotspot_factor >= 2.5 ? "critical" : res.hotspot_factor >= 1.4 ? "warn" : "ok"}`}>{res.verdict}</div>
          <div className="grid g3" style={{ gap: 10 }}>
            <div className={`kpi ${res.hotspot_factor >= 2.5 ? "bad" : "good"}`}><div className="l">Hottest shard load</div><div className="v">{res.hotspot_factor}× fair</div></div>
            <div className="kpi"><div className="l">Hottest shard</div><div className="v">#{res.hottest_shard + 1}</div></div>
            <div className="kpi"><div className="l">Storage imbalance</div><div className="v">{res.storage_cv}%</div></div>
          </div>
          <div className="grid g2">
            <div className="panel"><div className="panel-h small">Traffic share per shard (%)</div><div className="panel-b">
              <BarChart unit="%" refLine={100 / shards} bars={res.load_pct.map((v, i) => ({ label: `S${i + 1}`, value: v, color: i === res.hottest_shard && res.hotspot_factor >= 1.4 ? "#c4402e" : "#2c7c77" }))} />
            </div></div>
            <div className="panel"><div className="panel-h small">Keys stored per shard</div><div className="panel-b">
              <BarChart refLine={8000 / shards} bars={res.counts.map((v, i) => ({ label: `S${i + 1}`, value: v, color: "#7a5ca6" }))} />
            </div></div>
          </div>
        </div>
      )}
      {err && <div className="err-banner">{err}</div>}
    </div>
  );
}
