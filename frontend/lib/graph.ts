import { KINDS, type NodeKind } from "./kinds";

export type LabNode = {
  id: string;
  type: NodeKind;
  label?: string;
  x: number;
  y: number;
  replicas?: number;
  capacity?: number | null;
  latency?: number | null;
  hit_rate?: number | null;
  read_replicas?: number;
  shards?: number;
  autoscale?: boolean;
  min_replicas?: number;
  max_replicas?: number;
  fail_at?: number | null;
  fail_replicas?: number | null;
  recover_at?: number | null;
};

export type LabEdge = { source: string; target: string };

export type Traffic = {
  rps: number;
  read_ratio: number;
  duration: number;
  pattern: "steady" | "spike" | "ramp" | "diurnal";
  spike_multiplier: number;
  spike_at: number;
  spike_duration: number;
};

export type Graph = { nodes: LabNode[]; edges: LabEdge[] };

export const NODE_W = 132;
export const NODE_H = 60;

export const DEFAULT_TRAFFIC: Traffic = {
  rps: 2000, read_ratio: 0.9, duration: 60, pattern: "steady", spike_multiplier: 5, spike_at: 20, spike_duration: 10,
};

export const EMPTY_GRAPH: Graph = {
  nodes: [
    { id: "client", type: "client", label: "Users", x: 60, y: 240 },
    { id: "app", type: "server", label: "App Server", x: 330, y: 240 },
    { id: "db", type: "db", label: "Postgres", x: 600, y: 240 },
  ],
  edges: [{ source: "client", target: "app" }, { source: "app", target: "db" }],
};

let counter = 0;
export function newId(type: NodeKind, existing: LabNode[]): string {
  const ids = new Set(existing.map((n) => n.id));
  let id = "";
  do {
    counter += 1;
    id = `${type}${counter}`;
  } while (ids.has(id));
  return id;
}

export function makeNode(type: NodeKind, x: number, y: number, existing: LabNode[]): LabNode {
  const n: LabNode = { id: newId(type, existing), type, label: KINDS[type].label, x, y, replicas: 1 };
  if (type === "cache") n.hit_rate = 0.85;
  if (type === "cdn") n.hit_rate = 0.6;
  return n;
}

/** Strip UI-only/empty fields so the backend gets a clean NodeSpec. */
export function toSpec(nodes: LabNode[]) {
  return nodes.map((n) => {
    const o: Record<string, unknown> = { id: n.id, type: n.type, label: n.label || n.id, x: n.x, y: n.y, replicas: Math.max(1, n.replicas || 1) };
    if (n.capacity) o.capacity = n.capacity;
    if (n.latency !== undefined && n.latency !== null && !Number.isNaN(n.latency)) o.latency = n.latency;
    if (n.hit_rate !== undefined && n.hit_rate !== null) o.hit_rate = n.hit_rate;
    if (n.read_replicas) o.read_replicas = n.read_replicas;
    if (n.shards && n.shards > 1) o.shards = n.shards;
    if (n.autoscale) {
      o.autoscale = true;
      o.min_replicas = Math.max(1, n.min_replicas || n.replicas || 1);
      o.max_replicas = Math.max(o.min_replicas as number, n.max_replicas || 20);
    }
    if (n.fail_at !== undefined && n.fail_at !== null && !Number.isNaN(n.fail_at)) o.fail_at = n.fail_at;
    if (n.fail_replicas) o.fail_replicas = n.fail_replicas;
    if (n.recover_at !== undefined && n.recover_at !== null && !Number.isNaN(n.recover_at)) o.recover_at = n.recover_at;
    return o;
  });
}

export function effectiveCapacity(n: LabNode): number | null {
  const base = n.capacity || KINDS[n.type].cap;
  if (base === null) return null;
  if (n.type === "db" || n.type === "nosql" || n.type === "search") {
    return base * (n.shards || 1) * (1 + (n.read_replicas || 0));
  }
  return base * Math.max(1, n.replicas || 1);
}

export function monthlyCost(n: LabNode): number {
  const c = KINDS[n.type].cost;
  if (n.type === "db" || n.type === "nosql" || n.type === "search") return c * (n.shards || 1) * (1 + (n.read_replicas || 0));
  return c * Math.max(1, n.replicas || 1);
}

export function fmtNum(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e4) return Math.round(v / 1e3) + "k";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "k";
  return String(Math.round(v));
}
