"use client";

import { LineChart } from "@/components/charts/Charts";
import { fmtNum } from "@/lib/graph";
import { utilColor } from "@/lib/kinds";

export type SimResult = {
  summary: {
    total_requests: number; peak_rps: number; avg_rps: number; error_rate: number; availability: number;
    async_failures: number; p50: number; p95: number; p99: number; read_p99: number; write_p99: number;
    monthly_cost: number; bottleneck: string | null; final_backlog: number; peak_backlog: number;
  };
  nodes: Record<string, { label: string; type: string; avg_util: number; peak_util: number; dropped: number; avg_latency: number; avg_replicas: number; monthly_cost: number }>;
  timeline: { t: number; rps: number; success: number; errors: number; async_errors: number; p50: number; p95: number; p99: number; backlog: number; util: Record<string, number>; replicas: Record<string, number>; down: string[] }[];
  events: string[];
  findings: { level: "critical" | "warn" | "info"; code: string; message: string; node: string | null; fix: string | null }[];
  virtual_edges: { source: string; target: string }[];
};

export type GradeResult = { passed: boolean; score: number; checks: { name: string; passed: boolean; actual: string; target: string }[] };

export default function Results({ res, tick, grade, onFocusNode }: { res: SimResult; tick: number; grade?: GradeResult | null; onFocusNode: (id: string) => void }) {
  const s = res.summary;
  const tl = res.timeline;
  const errCls = s.error_rate > 0.01 ? "bad" : s.error_rate > 0.001 ? "warn" : "good";
  const p99Cls = s.p99 > 1000 ? "bad" : s.p99 > 300 ? "warn" : "good";
  const nodes = Object.entries(res.nodes).filter(([, v]) => v.type !== "client").sort((a, b) => b[1].peak_util - a[1].peak_util);
  return (
    <div className="stack" style={{ gap: 16 }}>
      {grade && (
        <div className={`alert ${grade.passed ? "ok" : "critical"}`}>
          <div className="row between">
            <b>{grade.passed ? "✓ Challenge passed" : "✗ Not yet"} · score {grade.score}/100</b>
          </div>
          <ul className="criteria small" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {grade.checks.map((c) => (
              <li key={c.name}>{c.passed ? "✅" : "❌"} {c.name}: <span className="mono">{c.actual}</span> <span className="muted">(target {c.target})</span></li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid g4" style={{ gap: 10 }}>
        <div className={`kpi ${errCls}`}><div className="l">Availability</div><div className="v">{s.availability.toFixed(2)}%</div><div className="tiny muted">{(s.error_rate * 100).toFixed(2)}% errors</div></div>
        <div className={`kpi ${p99Cls}`}><div className="l">p99 latency</div><div className="v">{s.p99} ms</div><div className="tiny muted">p50 {s.p50} · p95 {s.p95}</div></div>
        <div className="kpi"><div className="l">Throughput</div><div className="v">{fmtNum(s.avg_rps)}/s</div><div className="tiny muted">peak {fmtNum(s.peak_rps)} · {fmtNum(s.total_requests)} total</div></div>
        <div className="kpi"><div className="l">Monthly cost</div><div className="v">${s.monthly_cost.toLocaleString()}</div><div className="tiny muted">bottleneck: {s.bottleneck ? res.nodes[s.bottleneck]?.label : "—"}</div></div>
      </div>

      <div className="grid g2">
        <div className="panel"><div className="panel-h small">Traffic vs errors (req/s)</div><div className="panel-b">
          <LineChart marker={tick} series={[
            { name: "offered", color: "#7d7366", values: tl.map((x) => x.rps), dashed: true },
            { name: "success", color: "#3f8a4f", values: tl.map((x) => x.success), area: true },
            { name: "errors", color: "#c4402e", values: tl.map((x) => x.errors), area: true },
          ]} />
        </div></div>
        <div className="panel"><div className="panel-h small">Latency percentiles (ms)</div><div className="panel-b">
          <LineChart marker={tick} unit="" series={[
            { name: "p50", color: "#3a6fb0", values: tl.map((x) => x.p50) },
            { name: "p95", color: "#dca22c", values: tl.map((x) => x.p95) },
            { name: "p99", color: "#c4402e", values: tl.map((x) => x.p99) },
          ]} />
        </div></div>
      </div>
      {s.peak_backlog > 0 && (
        <div className="panel"><div className="panel-h small">Queue backlog (messages) · final {fmtNum(s.final_backlog)}</div><div className="panel-b">
          <LineChart marker={tick} height={130} series={[{ name: "backlog", color: "#dca22c", values: tl.map((x) => x.backlog), area: true }]} />
        </div></div>
      )}

      <div className="grid g2">
        <div className="panel">
          <div className="panel-h small">Utilisation at t={tick}s <span className="spacer" /><span className="muted tiny">click to select</span></div>
          <div className="panel-b stack" style={{ gap: 8 }}>
            {nodes.map(([id, v]) => {
              const u = tl[tick]?.util[id] ?? 0;
              return (
                <div key={id} onClick={() => onFocusNode(id)} style={{ cursor: "pointer" }}>
                  <div className="row between small"><span>{v.label}</span><span className="mono" style={{ color: utilColor(u) }}>
                    {tl[tick]?.down.includes(id) ? "DOWN" : u >= 999 ? "∞" : `${Math.round(u * 100)}%`} <span className="muted">· peak {v.peak_util >= 999 ? "∞" : Math.round(v.peak_util * 100) + "%"}</span></span></div>
                  <div className="util-bar"><div style={{ width: `${Math.min(100, u * 100)}%`, background: utilColor(u) }} /></div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="panel">
          <div className="panel-h small">Design review ({res.findings.length})</div>
          <div className="panel-b stack" style={{ gap: 8, maxHeight: 360, overflow: "auto" }}>
            {res.findings.length === 0 && <div className="alert ok">No issues found. Try harder traffic or failure injection.</div>}
            {res.findings.map((f, i) => (
              <div key={i} className={`alert ${f.level}`} onClick={() => f.node && onFocusNode(f.node)} style={{ cursor: f.node ? "pointer" : "default" }}>
                <div><b className="mono tiny">{f.code}</b> {f.message}</div>
                {f.fix && <div className="tiny muted" style={{ marginTop: 3 }}>Fix: {f.fix}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
      {res.events.length > 0 && (
        <div className="panel"><div className="panel-h small">Events</div>
          <div className="panel-b event-log">{res.events.map((e, i) => <div key={i}>{e}</div>)}</div>
        </div>
      )}
    </div>
  );
}
