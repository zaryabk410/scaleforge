export type NodeKind =
  | "client" | "dns" | "cdn" | "lb" | "gateway" | "server" | "cache"
  | "db" | "nosql" | "queue" | "worker" | "storage" | "search";

export const KINDS: Record<NodeKind, { label: string; color: string; short: string; desc: string; cap: number | null; lat: number; cost: number }> = {
  client:  { label: "Client",        color: "#6b625a", short: "USR", desc: "Where traffic enters: browsers, apps, devices.", cap: null, lat: 0, cost: 0 },
  dns:     { label: "DNS",           color: "#8a7f72", short: "DNS", desc: "Resolves names; GeoDNS can steer users to regions.", cap: 200000, lat: 1, cost: 10 },
  cdn:     { label: "CDN",           color: "#3a6fb0", short: "CDN", desc: "Edge caches near users. Serves hits in ~8 ms.", cap: 150000, lat: 6, cost: 250 },
  lb:      { label: "Load Balancer", color: "#2c7c77", short: "LB",  desc: "Spreads requests over healthy targets; routes around failures.", cap: 25000, lat: 1, cost: 25 },
  gateway: { label: "API Gateway",   color: "#4f8f6b", short: "GW",  desc: "Auth, routing, rate limiting for many services.", cap: 8000, lat: 3, cost: 60 },
  server:  { label: "App Server",    color: "#d4603a", short: "APP", desc: "Stateless service. ~1,000 req/s per replica.", cap: 1000, lat: 20, cost: 70 },
  cache:   { label: "Cache",         color: "#c4402e", short: "RDS", desc: "In-memory KV (Redis). Cache-aside when beside a DB.", cap: 60000, lat: 1, cost: 120 },
  db:      { label: "SQL Database",  color: "#7a5ca6", short: "SQL", desc: "Primary + read replicas, optional shards. Writes cost 2x.", cap: 2500, lat: 8, cost: 350 },
  nosql:   { label: "NoSQL Store",   color: "#9a6bb8", short: "KV",  desc: "Partitioned wide-column / KV. High write throughput.", cap: 10000, lat: 4, cost: 280 },
  queue:   { label: "Queue / Log",   color: "#dca22c", short: "MQ",  desc: "Buffers writes, ACKs fast; workers drain asynchronously.", cap: 50000, lat: 2, cost: 90 },
  worker:  { label: "Worker",        color: "#b5822a", short: "WRK", desc: "Consumes from queues. ~600 msg/s per replica.", cap: 600, lat: 25, cost: 55 },
  storage: { label: "Object Store",  color: "#5b8bb8", short: "S3",  desc: "Blobs, media, backups. Managed and durable.", cap: 8000, lat: 35, cost: 40 },
  search:  { label: "Search Index",  color: "#557a3c", short: "IDX", desc: "Full-text / faceted search (Elasticsearch).", cap: 2000, lat: 20, cost: 220 },
};

export const KIND_ORDER: NodeKind[] = ["client", "dns", "cdn", "lb", "gateway", "server", "cache", "db", "nosql", "queue", "worker", "storage", "search"];

export function utilColor(u: number): string {
  if (u >= 1) return "#c4402e";
  if (u >= 0.8) return "#d4603a";
  if (u >= 0.6) return "#dca22c";
  return "#3f8a4f";
}
