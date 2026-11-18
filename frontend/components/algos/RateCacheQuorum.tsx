"use client";

import { useEffect, useState } from "react";
import { BarChart, LineChart } from "@/components/charts/Charts";
import { api } from "@/lib/api";

type RL = {
  total_requests: number; bucket_seconds: number; limit: number; window: number;
  algorithms: Record<string, { name: string; allowed: number; denied: number; allowed_series: number[]; denied_series: number[]; state_series: number[]; max_in_any_window: number; overshoot: number; memory: string }>;
};

function Stacked({ a, d, max }: { a: number[]; d: number[]; max: number }) {
  const W = 640, H = 70, bw = W / a.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      {a.map((v, i) => {
        const ha = (v / max) * (H - 4), hd = (d[i] / max) * (H - 4);
        return (
          <g key={i}>
            <rect x={i * bw + 0.5} y={H - ha} width={Math.max(1, bw - 1)} height={ha} fill="#3f8a4f" />
            <rect x={i * bw + 0.5} y={H - ha - hd} width={Math.max(1, bw - 1)} height={hd} fill="#c4402e" opacity={0.75} />
          </g>
        );
      })}
    </svg>
  );
}

export function RateLimitLab() {
  const [cfg, setCfg] = useState({ pattern: "boundary", rate: 20, duration: 10, limit: 10, window: 1, burst: 10 });
  const [res, setRes] = useState<RL | null>(null);
  const [err, setErr] = useState("");
  const run = () => api<RL>("/labs/rate-limiter", cfg).then(setRes).catch((e) => setErr(e.message));
  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof cfg, v: string | number) => setCfg({ ...cfg, [k]: v });
  const max = res ? Math.max(1, ...Object.values(res.algorithms).flatMap((x) => x.allowed_series.map((v, i) => v + x.denied_series[i]))) : 1;
  return (
    <div className="grid" style={{ gridTemplateColumns: "300px minmax(0, 1fr)", gap: 18 }}>
      <div className="panel"><div className="panel-h">Traffic & limit</div><div className="panel-b stack">
        <label className="field">Traffic pattern
          <select value={cfg.pattern} onChange={(e) => set("pattern", e.target.value)}>
            <option value="boundary">Window-boundary bursts</option><option value="burst">Periodic bursts</option><option value="poisson">Random (Poisson)</option><option value="steady">Steady</option>
          </select>
        </label>
        <label className="field">Offered rate (req/s)<input type="number" value={cfg.rate} onChange={(e) => set("rate", Number(e.target.value))} /></label>
        <label className="field">Duration (s)<input type="number" value={cfg.duration} onChange={(e) => set("duration", Number(e.target.value))} /></label>
        <label className="field">Limit (requests per window)<input type="number" value={cfg.limit} onChange={(e) => set("limit", Number(e.target.value))} /></label>
        <label className="field">Window (s)<input type="number" step={0.5} value={cfg.window} onChange={(e) => set("window", Number(e.target.value))} /></label>
        <label className="field">Bucket size (token/leaky burst)<input type="number" value={cfg.burst} onChange={(e) => set("burst", Number(e.target.value))} /></label>
        <button className="btn" onClick={run}>Run all algorithms</button>
        {err && <div className="err-banner">{err}</div>}
        <p className="tiny muted">"Overshoot" = most requests admitted in any sliding window minus the limit. Fixed windows overshoot on boundary bursts.</p>
      </div></div>
      {res && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="small muted">{res.total_requests} requests · bars every {res.bucket_seconds}s · <span style={{ color: "#3f8a4f" }}>■ allowed</span> <span style={{ color: "#c4402e" }}>■ rejected (429)</span></div>
          {Object.entries(res.algorithms).map(([k, a]) => (
            <div key={k} className="panel">
              <div className="panel-h small">
                {a.name}<span className="spacer" />
                <span className="pill ok">{a.allowed} allowed</span>
                <span className="pill bad">{a.denied} denied</span>
                <span className={`pill ${a.overshoot ? "bad" : "ok"}`}>max/window {a.max_in_any_window}{a.overshoot ? ` (+${a.overshoot})` : ""}</span>
              </div>
              <div className="panel-b">
                <Stacked a={a.allowed_series} d={a.denied_series} max={max} />
                <div className="tiny muted">Memory: {a.memory}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type CacheRes = { trace_length: number; unique_keys: number; top_k_share: number; policies: Record<string, { name: string; hit_rate: number; curve: number[]; steps: { key: number; hit: boolean; cache: number[] }[] }> };
const PCOL: Record<string, string> = { lru: "#d4603a", lfu: "#7a5ca6", fifo: "#dca22c", random: "#7d7366", tinylfu: "#2c7c77", optimal: "#1f1b16" };

export function CacheLab() {
  const [cfg, setCfg] = useState({ capacity: 50, num_keys: 1000, length: 20000, alpha: 0.9, scan: true });
  const [res, setRes] = useState<CacheRes | null>(null);
  const [trace, setTrace] = useState("lru");
  const [err, setErr] = useState("");
  const run = () => api<CacheRes>("/labs/cache", cfg).then(setRes).catch((e) => setErr(e.message));
  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid" style={{ gridTemplateColumns: "300px minmax(0, 1fr)", gap: 18 }}>
      <div className="panel"><div className="panel-h">Workload</div><div className="panel-b stack">
        <label className="field">Cache capacity (items)<input type="number" value={cfg.capacity} onChange={(e) => setCfg({ ...cfg, capacity: Number(e.target.value) })} /></label>
        <label className="field">Distinct keys<input type="number" value={cfg.num_keys} onChange={(e) => setCfg({ ...cfg, num_keys: Number(e.target.value) })} /></label>
        <label className="field">Accesses<input type="number" value={cfg.length} onChange={(e) => setCfg({ ...cfg, length: Number(e.target.value) })} /></label>
        <label className="field">Popularity skew (zipf α): {cfg.alpha}<input type="range" min={0} max={1.8} step={0.05} value={cfg.alpha} onChange={(e) => setCfg({ ...cfg, alpha: Number(e.target.value) })} /></label>
        <label className="row small"><input type="checkbox" checked={cfg.scan} onChange={(e) => setCfg({ ...cfg, scan: e.target.checked })} /> Inject one-hit-wonder scans (batch jobs)</label>
        <button className="btn" onClick={run}>Simulate</button>
        {err && <div className="err-banner">{err}</div>}
      </div></div>
      {res && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="small muted">{res.trace_length.toLocaleString()} accesses · {res.unique_keys.toLocaleString()} unique keys · the top {cfg.capacity} keys receive {res.top_k_share}% of traffic</div>
          <div className="grid g2">
            <div className="panel"><div className="panel-h small">Hit rate by policy (%)</div><div className="panel-b">
              <BarChart unit="%" bars={Object.entries(res.policies).map(([k, p]) => ({ label: p.name.split(" ")[0], value: p.hit_rate, color: PCOL[k] }))} />
              <div className="tiny muted">Belady = theoretical best (knows the future).</div>
            </div></div>
            <div className="panel"><div className="panel-h small">Hit rate over time (%)</div><div className="panel-b">
              <LineChart xUnit="" yMax={100} series={Object.entries(res.policies).filter(([k]) => k !== "optimal").map(([k, p]) => ({ name: p.name, color: PCOL[k], values: p.curve }))} />
            </div></div>
          </div>
          <div className="panel"><div className="panel-h small">
            First 40 accesses ·
            <select value={trace} onChange={(e) => setTrace(e.target.value)} style={{ width: 180, marginLeft: 8 }}>
              {Object.entries(res.policies).filter(([k]) => k !== "optimal").map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
            </select>
          </div><div className="panel-b" style={{ overflowX: "auto" }}>
            <table className="t"><thead><tr><th>#</th><th>key</th><th>result</th><th>cache contents (up to 12)</th></tr></thead><tbody>
              {res.policies[trace]?.steps.map((s, i) => (
                <tr key={i}><td className="mono">{i + 1}</td><td className="mono">{s.key}</td>
                  <td><span className={`pill ${s.hit ? "ok" : "bad"}`}>{s.hit ? "HIT" : "MISS"}</span></td>
                  <td className="mono tiny">{s.cache.join(" · ")}</td></tr>
              ))}
            </tbody></table>
          </div></div>
        </div>
      )}
    </div>
  );
}

type QR = { n: number; r: number; w: number; failed: number; strong_quorum: boolean; overlap: number; write_available: boolean; read_available: boolean; stale_read_pct: number | null; write_p50: number; write_p99: number; read_p50: number; read_p99: number; tolerates_failures: { writes: number; reads: number }; explanation: string };

export function QuorumLab() {
  const [cfg, setCfg] = useState({ n: 3, r: 1, w: 1, failed: 0, replication_ms: 30, read_delay_ms: 5 });
  const [res, setRes] = useState<QR | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setErr("");
    api<QR>("/labs/quorum", cfg).then(setRes).catch((e) => setErr(e.message));
  }, [cfg]);
  const slider = (k: keyof typeof cfg, label: string, min: number, max: number, step = 1) => (
    <label className="field">{label}: {cfg[k]}<input type="range" min={min} max={max} step={step} value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })} /></label>
  );
  const R = 110, cx = 160, cy = 140;
  return (
    <div className="grid" style={{ gridTemplateColumns: "300px minmax(0, 1fr)", gap: 18 }}>
      <div className="panel"><div className="panel-h">Dynamo-style quorum</div><div className="panel-b stack">
        {slider("n", "N replicas", 1, 9)}
        {slider("w", "W (write acks)", 1, cfg.n)}
        {slider("r", "R (read replies)", 1, cfg.n)}
        {slider("failed", "Failed replicas", 0, cfg.n - 1)}
        {slider("replication_ms", "Mean replication delay (ms)", 1, 200)}
        {slider("read_delay_ms", "Read issued after write ACK (ms)", 0, 200)}
        <div className="row">
          {[[3, 2, 2], [3, 1, 1], [5, 3, 3], [5, 1, 5]].map(([n, r, w]) => (
            <button key={`${n}${r}${w}`} className="btn ghost sm" onClick={() => setCfg({ ...cfg, n, r, w, failed: 0 })}>N{n} R{r} W{w}</button>
          ))}
        </div>
        {err && <div className="err-banner">{err}</div>}
      </div></div>
      {res && (
        <div className="stack" style={{ gap: 14 }}>
          <div className={`alert ${res.strong_quorum ? "ok" : "warn"}`}>{res.explanation}</div>
          <div className="grid g4" style={{ gap: 10 }}>
            <div className={`kpi ${res.stale_read_pct ? "bad" : "good"}`}><div className="l">Stale reads</div><div className="v">{res.stale_read_pct === null ? "n/a" : `${res.stale_read_pct}%`}</div></div>
            <div className={`kpi ${res.write_available ? "good" : "bad"}`}><div className="l">Writes</div><div className="v">{res.write_available ? "available" : "REJECTED"}</div><div className="tiny muted">tolerates {res.tolerates_failures.writes} down</div></div>
            <div className={`kpi ${res.read_available ? "good" : "bad"}`}><div className="l">Reads</div><div className="v">{res.read_available ? "available" : "REJECTED"}</div><div className="tiny muted">tolerates {res.tolerates_failures.reads} down</div></div>
            <div className="kpi"><div className="l">Write latency</div><div className="v">{res.write_p50} ms</div><div className="tiny muted">p99 {res.write_p99} ms (waits for W-th ack)</div></div>
          </div>
          <div className="panel"><div className="panel-h small">Replica set</div><div className="panel-b center">
            <svg viewBox="0 0 320 280" style={{ width: "100%", maxWidth: 420 }}>
              {Array.from({ length: cfg.n }).map((_, i) => {
                const a = (i / cfg.n) * 2 * Math.PI;
                const x = cx + R * Math.sin(a), y = cy - R * Math.cos(a);
                const dead = i >= cfg.n - cfg.failed;
                const inW = !dead && i < cfg.w;
                const inR = !dead && i >= Math.max(0, cfg.n - cfg.failed - cfg.r) && i < cfg.n - cfg.failed;
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={26} fill={dead ? "#d8cfc4" : "#fffdf9"} stroke={inW && inR ? "#2c7c77" : inW ? "#7a5ca6" : inR ? "#3a6fb0" : "#c7b9a5"} strokeWidth={inW || inR ? 4 : 1.5} />
                    <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={dead ? "#c4402e" : "#1f1b16"}>{dead ? "✕" : `R${i + 1}`}</text>
                  </g>
                );
              })}
              <text x={cx} y={cy} textAnchor="middle" fontSize={12} fill="#7d7366">overlap = {res.overlap}</text>
            </svg>
            <div className="legend-row" style={{ justifyContent: "center" }}>
              <span><i style={{ background: "#7a5ca6" }} />write quorum (W)</span><span><i style={{ background: "#3a6fb0" }} />read quorum (R, worst case)</span><span><i style={{ background: "#2c7c77" }} />both</span>
            </div>
          </div></div>
        </div>
      )}
    </div>
  );
}
