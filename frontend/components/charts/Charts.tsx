"use client";

export type Series = { name: string; color: string; values: number[]; dashed?: boolean; area?: boolean };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function fmt(v: number) {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + "k";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function LineChart({ series, height = 170, unit = "", marker, yMax, xStep = 1, xUnit = "s" }: {
  series: Series[]; height?: number; unit?: string; marker?: number; yMax?: number; xStep?: number; xUnit?: string;
}) {
  const W = 640, H = height, L = 44, R = 10, T = 10, B = 22;
  const n = Math.max(...series.map((s) => s.values.length), 2);
  const max = yMax ?? niceMax(Math.max(1e-9, ...series.flatMap((s) => s.values)));
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - Math.min(v, max) / max) * (H - T - B);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const xt = Math.max(1, Math.ceil(n / 8));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e4d9c8" />
            <text x={L - 6} y={y(t) + 3} textAnchor="end">{fmt(t)}{unit}</text>
          </g>
        ))}
        {Array.from({ length: n }).map((_, i) => i % xt === 0 && (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{fmt(i * xStep)}{xUnit}</text>
        ))}
        {series.map((s) => {
          const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          return (
            <g key={s.name}>
              {s.area && <path d={`${d} L${x(s.values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={s.color} opacity={0.12} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />
            </g>
          );
        })}
        {marker !== undefined && marker >= 0 && (
          <line x1={x(marker)} x2={x(marker)} y1={T} y2={H - B} stroke="#1f1b16" strokeDasharray="3 3" />
        )}
      </svg>
      <div className="legend-row">
        {series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}
      </div>
    </div>
  );
}

export function BarChart({ bars, height = 160, unit = "", refLine }: {
  bars: { label: string; value: number; color?: string }[]; height?: number; unit?: string; refLine?: number;
}) {
  const W = 640, H = height, L = 40, R = 8, T = 10, B = 26;
  const max = niceMax(Math.max(1e-9, refLine ?? 0, ...bars.map((b) => b.value)));
  const bw = (W - L - R) / Math.max(1, bars.length);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W - R} y1={y(f * max)} y2={y(f * max)} stroke="#e4d9c8" />
          <text x={L - 6} y={y(f * max) + 3} textAnchor="end">{fmt(f * max)}{unit}</text>
        </g>
      ))}
      {bars.map((b, i) => (
        <g key={i}>
          <rect x={L + i * bw + bw * 0.15} y={y(b.value)} width={bw * 0.7} height={Math.max(0, y(0) - y(b.value))} rx={3} fill={b.color || "#d4603a"} />
          <text x={L + i * bw + bw / 2} y={H - 8} textAnchor="middle">{b.label}</text>
        </g>
      ))}
      {refLine !== undefined && (
        <line x1={L} x2={W - R} y1={y(refLine)} y2={y(refLine)} stroke="#1f1b16" strokeDasharray="4 3" />
      )}
    </svg>
  );
}
