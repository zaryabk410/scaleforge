"use client";

import { useRef, useState } from "react";
import { KINDS, utilColor, type NodeKind } from "@/lib/kinds";
import { NODE_H, NODE_W, type LabEdge, type LabNode } from "@/lib/graph";

type Props = {
  nodes: LabNode[];
  edges: LabEdge[];
  virtualEdges?: LabEdge[];
  selected: { kind: "node" | "edge"; id: string } | null;
  util?: Record<string, number>;
  replicasNow?: Record<string, number>;
  down?: string[];
  onSelect: (s: { kind: "node" | "edge"; id: string } | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMoveEnd: () => void;
  onConnect: (source: string, target: string) => void;
  onDropKind: (kind: NodeKind, x: number, y: number) => void;
};

const W = 1400, H = 760;

export const edgeId = (e: LabEdge) => `${e.source}->${e.target}`;

function pathFor(a: LabNode, b: LabNode) {
  const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2;
  let x2 = b.x, y2 = b.y + NODE_H / 2;
  if (b.x + NODE_W / 2 < a.x + NODE_W / 2) {
    // target is to the left: attach to its right side and loop around
    x2 = b.x + NODE_W;
  }
  const dx = Math.max(50, Math.abs(x2 - x1) * 0.5);
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - (x2 > x1 ? dx : -dx)},${y2} ${x2},${y2}`;
}

export default function Canvas(p: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const [link, setLink] = useState<{ from: string; x: number; y: number } | null>(null);
  const byId = new Map(p.nodes.map((n) => [n.id, n]));

  const pt = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div
      className="canvas-wrap"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const kind = e.dataTransfer.getData("text/kind") as NodeKind;
        if (!kind || !KINDS[kind]) return;
        const { x, y } = pt(e);
        p.onDropKind(kind, Math.max(0, x - NODE_W / 2), Math.max(0, y - NODE_H / 2));
      }}
    >
      <svg
        ref={svg}
        width={W}
        height={H}
        onPointerMove={(e) => {
          const { x, y } = pt(e);
          if (drag) {
            p.onMove(drag.id, Math.max(0, Math.min(W - NODE_W, x - drag.dx)), Math.max(0, Math.min(H - NODE_H, y - drag.dy)));
            if (!drag.moved) setDrag({ ...drag, moved: true });
          } else if (link) setLink({ ...link, x, y });
        }}
        onPointerUp={() => {
          if (drag?.moved) p.onMoveEnd();
          setDrag(null);
          setLink(null);
        }}
        onPointerLeave={() => { setDrag(null); setLink(null); }}
        onPointerDown={(e) => { if (e.target === svg.current) p.onSelect(null); }}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#a89a86" />
          </marker>
          <marker id="arrow-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#d4603a" />
          </marker>
        </defs>

        {p.virtualEdges?.map((e) => {
          const a = byId.get(e.source), b = byId.get(e.target);
          if (!a || !b) return null;
          return <path key={"v" + edgeId(e)} d={pathFor(a, b)} fill="none" stroke="#c7b9a5" strokeWidth={1.5} strokeDasharray="4 5" />;
        })}

        {p.edges.map((e) => {
          const a = byId.get(e.source), b = byId.get(e.target);
          if (!a || !b) return null;
          const id = edgeId(e);
          const sel = p.selected?.kind === "edge" && p.selected.id === id;
          const u = p.util?.[e.target];
          const stroke = sel ? "#d4603a" : u !== undefined && u >= 1 ? "#c4402e" : "#a89a86";
          return (
            <g key={id}>
              <path d={pathFor(a, b)} fill="none" stroke="transparent" strokeWidth={14} className="edge-path"
                onPointerDown={(ev) => { ev.stopPropagation(); p.onSelect({ kind: "edge", id }); }} />
              <path d={pathFor(a, b)} fill="none" stroke={stroke} strokeWidth={sel ? 3 : 2} markerEnd={`url(#${sel ? "arrow-sel" : "arrow"})`} pointerEvents="none" />
            </g>
          );
        })}

        {link && byId.get(link.from) && (
          <line x1={byId.get(link.from)!.x + NODE_W} y1={byId.get(link.from)!.y + NODE_H / 2} x2={link.x} y2={link.y}
            stroke="#d4603a" strokeWidth={2} strokeDasharray="5 4" pointerEvents="none" />
        )}

        {p.nodes.map((n) => {
          const k = KINDS[n.type];
          const sel = p.selected?.kind === "node" && p.selected.id === n.id;
          const u = p.util?.[n.id];
          const isDown = p.down?.includes(n.id);
          const reps = p.replicasNow?.[n.id] ?? n.replicas ?? 1;
          let sub = "";
          if (n.type === "db" || n.type === "nosql" || n.type === "search") {
            sub = `${n.shards && n.shards > 1 ? `${n.shards} shards · ` : ""}${n.read_replicas ? `+${n.read_replicas} replica${n.read_replicas > 1 ? "s" : ""}` : "no replica"}`;
          } else if (n.type === "cache" || n.type === "cdn") {
            sub = `×${reps} · hit ${Math.round((n.hit_rate ?? 0) * 100)}%`;
          } else if (n.type !== "client") {
            sub = `×${reps}${n.autoscale ? ` (auto ${n.min_replicas || 1}–${n.max_replicas || 20})` : ""}`;
          } else sub = "traffic source";
          return (
            <g key={n.id} className={`node-g ${sel ? "sel" : ""}`} transform={`translate(${n.x},${n.y})`}
              onPointerDown={(e) => {
                e.stopPropagation();
                const { x, y } = pt(e);
                setDrag({ id: n.id, dx: x - n.x, dy: y - n.y, moved: false });
                p.onSelect({ kind: "node", id: n.id });
              }}
              onPointerUp={(e) => {
                if (link && link.from !== n.id) {
                  e.stopPropagation();
                  p.onConnect(link.from, n.id);
                  setLink(null);
                }
              }}
            >
              <rect className="body" width={NODE_W} height={NODE_H} rx={10} fill={isDown ? "#e6ded3" : "#fffdf9"}
                stroke={isDown ? "#c4402e" : u !== undefined && u >= 1 ? "#c4402e" : "#c7b9a5"} strokeWidth={1.4} />
              <rect width={34} height={NODE_H} rx={10} fill={k.color} opacity={isDown ? 0.4 : 1} />
              <rect x={24} width={10} height={NODE_H} fill={k.color} opacity={isDown ? 0.4 : 1} />
              <text x={17} y={NODE_H / 2 + 4} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#fff" fontFamily="var(--mono)">{k.short}</text>
              <text x={42} y={22} fontSize={12.5} fontWeight={650} fill="#1f1b16">{(n.label || n.id).slice(0, 15)}</text>
              <text x={42} y={39} fontSize={10.5} fill="#7d7366">{sub.slice(0, 22)}</text>
              {u !== undefined && n.type !== "client" && (
                <g>
                  <rect x={42} y={46} width={NODE_W - 54} height={5} rx={2.5} fill="#ebe2d5" />
                  <rect x={42} y={46} width={Math.min(1, u) * (NODE_W - 54)} height={5} rx={2.5} fill={utilColor(u)} />
                  <text x={NODE_W - 8} y={22} textAnchor="end" fontSize={10} fontWeight={700} fill={utilColor(u)} fontFamily="var(--mono)">
                    {isDown ? "DOWN" : u >= 999 ? "∞" : `${Math.round(u * 100)}%`}
                  </text>
                </g>
              )}
              {isDown && <text x={NODE_W - 8} y={22} textAnchor="end" fontSize={10} fontWeight={700} fill="#c4402e">DOWN</text>}
              <circle className="port" cx={NODE_W} cy={NODE_H / 2} r={7} fill="#fffdf9" stroke="#d4603a" strokeWidth={2}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const { x, y } = pt(e);
                  setLink({ from: n.id, x, y });
                }} />
            </g>
          );
        })}

        {p.nodes.length === 0 && (
          <text x={W / 2 - 300} y={260} fontSize={16} fill="#7d7366">Drag components here, then drag from a node&apos;s orange port to connect.</text>
        )}
      </svg>
    </div>
  );
}
