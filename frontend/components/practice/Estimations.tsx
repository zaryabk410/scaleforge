"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getUid } from "@/lib/uid";

type E = { id: string; title: string; difficulty: string; unit: string; prompt: string; tolerance: number };
type Check = { correct: boolean; verdict: string; answer: number; error_pct: number; right_order_of_magnitude: boolean; steps: string[]; unit: string };

export function Estimations() {
  const [items, setItems] = useState<E[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [res, setRes] = useState<Record<string, Check>>({});
  const [err, setErr] = useState("");
  useEffect(() => { api<E[]>("/practice/estimations").then(setItems).catch((e) => setErr(e.message)); }, []);
  const check = async (id: string) => {
    const v = Number(vals[id]);
    if (!Number.isFinite(v)) return;
    try {
      const r = await api<Check>(`/practice/estimations/${id}/check`, { value: v, uid: getUid() });
      setRes({ ...res, [id]: r });
    } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="muted small" style={{ margin: 0 }}>Back-of-the-envelope math is graded within a tolerance (usually ±20–30%). Round aggressively: 86,400 ≈ 10⁵ seconds/day.</p>
      {err && <div className="err-banner">{err}</div>}
      <div className="grid g2">
        {items.map((e) => {
          const r = res[e.id];
          return (
            <div key={e.id} className="card flat stack">
              <div className="row between"><h3 style={{ margin: 0 }}>{e.title}</h3><span className={`pill ${e.difficulty}`}>{e.difficulty}</span></div>
              <p className="small" style={{ margin: 0 }}>{e.prompt}</p>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input type="number" placeholder="Your estimate" value={vals[e.id] || ""} onChange={(ev) => setVals({ ...vals, [e.id]: ev.target.value })}
                  onKeyDown={(ev) => ev.key === "Enter" && check(e.id)} />
                <span className="small muted" style={{ whiteSpace: "nowrap" }}>{e.unit}</span>
                <button className="btn sm" onClick={() => check(e.id)}>Check</button>
              </div>
              {r && (
                <div className={`alert ${r.correct ? "ok" : r.right_order_of_magnitude ? "warn" : "critical"} small`}>
                  <b>{r.verdict}</b> · answer ≈ <span className="mono">{r.answer.toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.unit}</span> (you were {r.error_pct}% off)
                  <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>{r.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const fmt = (v: number, unit = "") => {
  const abs = Math.abs(v);
  const s = abs >= 1e12 ? (v / 1e12).toFixed(2) + "T" : abs >= 1e9 ? (v / 1e9).toFixed(2) + "B" : abs >= 1e6 ? (v / 1e6).toFixed(2) + "M" : abs >= 1e3 ? (v / 1e3).toFixed(1) + "k" : v.toFixed(v < 10 ? 2 : 0);
  return s + unit;
};
const bytes = (b: number) => {
  const u = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
  let i = 0;
  while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; }
  return `${b.toFixed(b < 10 ? 2 : 1)} ${u[i]}`;
};

export function Estimator() {
  const [c, setC] = useState({ dau: 100e6, actions: 20, writeShare: 10, objectKB: 2, mediaShare: 5, mediaMB: 1, years: 5, replication: 3, peak: 2.5, perServer: 1000, cacheShare: 20 });
  const set = (k: keyof typeof c, v: number) => setC({ ...c, [k]: v });
  const r = useMemo(() => {
    const reqDay = c.dau * c.actions;
    const avg = reqDay / 86400;
    const writes = avg * (c.writeShare / 100);
    const reads = avg - writes;
    const peak = avg * c.peak;
    const writesDay = reqDay * (c.writeShare / 100);
    const bytesDay = writesDay * c.objectKB * 1e3 + writesDay * (c.mediaShare / 100) * c.mediaMB * 1e6;
    const total = bytesDay * 365 * c.years * c.replication;
    const egress = reads * (c.objectKB * 1e3 + (c.mediaShare / 100) * c.mediaMB * 1e6);
    const cache = reqDay * (1 - c.writeShare / 100) * (c.cacheShare / 100) * c.objectKB * 1e3;
    return { avg, reads, writes, peak, bytesDay, total, egress, cache, servers: Math.ceil(peak / (c.perServer * 0.65)) };
  }, [c]);
  const F = (k: keyof typeof c, label: string, step = 1) => (
    <label className="field">{label}<input type="number" step={step} value={c[k]} onChange={(e) => set(k, Number(e.target.value))} /></label>
  );
  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18 }}>
      <div className="panel"><div className="panel-h">Assumptions</div><div className="panel-b grid g2" style={{ gap: 10 }}>
        {F("dau", "Daily active users")}{F("actions", "Requests per user / day")}
        {F("writeShare", "Writes (% of requests)")}{F("objectKB", "Avg record size (KB)", 0.1)}
        {F("mediaShare", "Writes with media (%)")}{F("mediaMB", "Avg media size (MB)", 0.1)}
        {F("years", "Retention (years)")}{F("replication", "Replication factor")}
        {F("peak", "Peak / average", 0.1)}{F("perServer", "Req/s per server")}
        {F("cacheShare", "Cache hot set (% of daily reads)")}
      </div></div>
      <div className="panel"><div className="panel-h">Results</div><div className="panel-b">
        <table className="t"><tbody>
          <tr><td>Average QPS</td><td className="num">{fmt(r.avg)}/s</td></tr>
          <tr><td>Peak QPS</td><td className="num">{fmt(r.peak)}/s</td></tr>
          <tr><td>Read QPS (avg)</td><td className="num">{fmt(r.reads)}/s</td></tr>
          <tr><td>Write QPS (avg)</td><td className="num">{fmt(r.writes)}/s</td></tr>
          <tr><td>New data per day</td><td className="num">{bytes(r.bytesDay)}</td></tr>
          <tr><td>Total storage ({c.years} y × {c.replication} copies)</td><td className="num">{bytes(r.total)}</td></tr>
          <tr><td>Read egress (avg)</td><td className="num">{bytes(r.egress)}/s ≈ {fmt((r.egress * 8) / 1e9)} Gbps</td></tr>
          <tr><td>Cache memory (hot set)</td><td className="num">{bytes(r.cache)}</td></tr>
          <tr><td>App servers @65% peak util</td><td className="num">{r.servers.toLocaleString()}</td></tr>
        </tbody></table>
        <p className="tiny muted" style={{ marginTop: 8 }}>Formulas: QPS = DAU × actions / 86,400. Storage = writes/day × size × 365 × years × replication. Cache ≈ hot share of daily reads × record size (upper bound: ignores duplicates).</p>
      </div></div>
    </div>
  );
}
