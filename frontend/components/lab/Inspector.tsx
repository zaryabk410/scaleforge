"use client";

import { KINDS } from "@/lib/kinds";
import { effectiveCapacity, fmtNum, monthlyCost, type LabEdge, type LabNode } from "@/lib/graph";

type Props = {
  node?: LabNode;
  edge?: LabEdge;
  nodes: LabNode[];
  onChange: (patch: Partial<LabNode>) => void;
  onDelete: () => void;
  stats?: { avg_util: number; peak_util: number; dropped: number; avg_latency: number; monthly_cost: number; avg_replicas: number };
};

function Num({ label, value, onChange, min = 0, max, step = 1, placeholder }: {
  label: string; value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; placeholder?: string;
}) {
  return (
    <label className="field">
      {label}
      <input type="number" min={min} max={max} step={step} value={value ?? ""} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
    </label>
  );
}

export default function Inspector({ node, edge, nodes, onChange, onDelete, stats }: Props) {
  if (edge) {
    const a = nodes.find((n) => n.id === edge.source), b = nodes.find((n) => n.id === edge.target);
    return (
      <div className="panel inspector">
        <div className="panel-h">Connection</div>
        <div className="panel-b stack">
          <div className="small"><b>{a?.label}</b> → <b>{b?.label}</b></div>
          <p className="small muted" style={{ margin: 0 }}>Requests flow in this direction. Routing depends on the source type: load balancers spread by capacity, services prefer caches for reads and queues for writes.</p>
          <button className="btn danger sm" onClick={onDelete}>Delete connection</button>
        </div>
      </div>
    );
  }
  if (!node) {
    return (
      <div className="panel inspector">
        <div className="panel-h">Inspector</div>
        <div className="panel-b small muted stack">
          <div>Select a component to edit replicas, capacity, hit rate, shards, autoscaling and failure injection.</div>
          <div><b>Connect:</b> drag from the orange port on a node&apos;s right edge onto another node.</div>
          <div><b>Delete:</b> select, then press Delete/Backspace.</div>
          <div><b>Cache-aside:</b> connect a service to both a Cache and a DB; misses fall through automatically (dashed line).</div>
        </div>
      </div>
    );
  }
  const k = KINDS[node.type];
  const t = node.type;
  const isData = t === "db" || t === "nosql" || t === "search";
  const scalable = t === "server" || t === "worker" || t === "gateway" || t === "lb";
  const cap = effectiveCapacity(node);
  return (
    <div className="panel inspector">
      <div className="panel-h">
        <span className="dot" style={{ background: k.color }} /> {k.label}
        <span className="spacer" />
        <span className="mono tiny muted">{node.id}</span>
      </div>
      <div className="panel-b stack">
        <p className="small muted" style={{ margin: 0 }}>{k.desc}</p>
        <label className="field">Label<input type="text" value={node.label || ""} onChange={(e) => onChange({ label: e.target.value })} /></label>
        {t !== "client" && (
          <>
            <div className="grid g2" style={{ gap: 8 }}>
              {!isData && <Num label="Replicas" min={1} max={500} value={node.replicas ?? 1} onChange={(v) => onChange({ replicas: Math.max(1, v || 1) })} />}
              {isData && <Num label="Read replicas" min={0} max={15} value={node.read_replicas ?? 0} onChange={(v) => onChange({ read_replicas: v || 0 })} />}
              {isData && <Num label="Shards" min={1} max={64} value={node.shards ?? 1} onChange={(v) => onChange({ shards: Math.max(1, v || 1) })} />}
              <Num label="Capacity / instance (rps)" value={node.capacity} placeholder={String(k.cap)} onChange={(v) => onChange({ capacity: v })} />
              <Num label="Base latency (ms)" value={node.latency} step={0.5} placeholder={String(k.lat)} onChange={(v) => onChange({ latency: v })} />
            </div>
            {(t === "cache" || t === "cdn") && (
              <label className="field">
                Hit rate: {Math.round((node.hit_rate ?? 0) * 100)}%
                <input type="range" min={0} max={1} step={0.01} value={node.hit_rate ?? 0} onChange={(e) => onChange({ hit_rate: Number(e.target.value) })} />
              </label>
            )}
            {scalable && (
              <div className="card flat" style={{ padding: 10 }}>
                <label className="row small" style={{ fontWeight: 600 }}>
                  <input type="checkbox" checked={!!node.autoscale} onChange={(e) => onChange({ autoscale: e.target.checked, min_replicas: node.min_replicas || node.replicas || 1, max_replicas: node.max_replicas || 20 })} />
                  Autoscaling (target 55% util, 3 s boot)
                </label>
                {node.autoscale && (
                  <div className="grid g2" style={{ gap: 8, marginTop: 8 }}>
                    <Num label="Min" min={1} value={node.min_replicas} onChange={(v) => onChange({ min_replicas: Math.max(1, v || 1) })} />
                    <Num label="Max" min={1} value={node.max_replicas} onChange={(v) => onChange({ max_replicas: Math.max(1, v || 1) })} />
                  </div>
                )}
              </div>
            )}
            <div className="card flat" style={{ padding: 10 }}>
              <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Failure injection</div>
              <div className="grid g3" style={{ gap: 6 }}>
                <Num label="Fail at (s)" value={node.fail_at} onChange={(v) => onChange({ fail_at: v })} />
                <Num label={isData ? "Instances" : "Replicas"} min={1} value={node.fail_replicas} placeholder="all" onChange={(v) => onChange({ fail_replicas: v })} />
                <Num label="Recover (s)" value={node.recover_at} onChange={(v) => onChange({ recover_at: v })} />
              </div>
            </div>
            <div className="small muted">
              Capacity ≈ <b className="mono">{cap === null ? "∞" : fmtNum(cap)}</b> rps{isData ? " (reads; writes cost more on the primary)" : ""} · ~<b className="mono">${monthlyCost(node).toLocaleString()}</b>/mo
            </div>
          </>
        )}
        {stats && t !== "client" && (
          <div className="card flat" style={{ padding: 10 }}>
            <div className="small" style={{ fontWeight: 600 }}>Last run</div>
            <table className="t"><tbody>
              <tr><td>Avg / peak util</td><td className="num">{Math.round(stats.avg_util * 100)}% / {stats.peak_util >= 999 ? "∞" : Math.round(stats.peak_util * 100) + "%"}</td></tr>
              <tr><td>Dropped</td><td className="num">{fmtNum(stats.dropped)}</td></tr>
              <tr><td>Avg service time</td><td className="num">{stats.avg_latency} ms</td></tr>
              <tr><td>Avg replicas</td><td className="num">{stats.avg_replicas}</td></tr>
            </tbody></table>
          </div>
        )}
        <button className="btn danger sm" onClick={onDelete}>Delete component</button>
      </div>
    </div>
  );
}
