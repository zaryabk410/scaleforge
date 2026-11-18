export type Sheet =
  | { title: string; tag: string; kind: "table"; head?: string[]; rows: string[][]; note?: string }
  | { title: string; tag: string; kind: "list"; items: string[]; note?: string };

export const SHEETS: Sheet[] = [
  {
    title: "Latency numbers", tag: "numbers", kind: "table", head: ["Operation", "Time"],
    rows: [
      ["L1 cache hit", "1 ns"], ["Branch mispredict", "3 ns"], ["L2 cache hit", "4 ns"], ["Mutex lock/unlock", "17 ns"],
      ["Main memory", "100 ns"], ["Compress 1 KB (Snappy)", "2 µs"], ["Read 1 MB sequentially (RAM)", "3 µs"],
      ["SSD random read (4 KB)", "16 µs"], ["Read 1 MB sequentially (SSD)", "50 µs"], ["Round trip, same DC", "500 µs"],
      ["Redis GET (same AZ)", "~0.3 ms"], ["Read 1 MB sequentially (HDD)", "~1 ms"], ["HDD seek", "2–10 ms"],
      ["Cross-AZ round trip", "1–2 ms"], ["US East ↔ West", "~65 ms"], ["US ↔ Europe", "~80–100 ms"], ["US ↔ Asia", "~150–250 ms"],
    ],
    note: "Memory is ~100x faster than SSD, which is ~20x faster than a network hop across regions.",
  },
  {
    title: "Powers of two & units", tag: "numbers", kind: "table", head: ["Power", "Value", "Name"],
    rows: [["2¹⁰", "1 thousand", "KB"], ["2²⁰", "1 million", "MB"], ["2³⁰", "1 billion", "GB"], ["2⁴⁰", "1 trillion", "TB"], ["2⁵⁰", "1 quadrillion", "PB"],
      ["2³²", "4.3 billion", "IPv4 / int32 range"], ["2⁶⁴", "1.8 × 10¹⁹", "int64 range"]],
  },
  {
    title: "Time shortcuts", tag: "numbers", kind: "table", head: ["Period", "Seconds"],
    rows: [["1 day", "86,400 ≈ 10⁵"], ["1 month", "~2.6 M"], ["1 year", "~31.5 M ≈ π × 10⁷"],
      ["1M req/day", "≈ 12 req/s"], ["100M req/day", "≈ 1,160 req/s"], ["1B req/day", "≈ 11,600 req/s"]],
  },
  {
    title: "Availability (nines)", tag: "reliability", kind: "table", head: ["SLO", "Per year", "Per month", "Per day"],
    rows: [["99%", "3.65 d", "7.3 h", "14.4 min"], ["99.9%", "8.77 h", "43.8 min", "1.44 min"], ["99.95%", "4.38 h", "21.9 min", "43 s"],
      ["99.99%", "52.6 min", "4.38 min", "8.6 s"], ["99.999%", "5.26 min", "26 s", "0.86 s"]],
    note: "Series: A × B. Parallel (redundant): 1 − (1−A)(1−B).",
  },
  {
    title: "Capacity formulas", tag: "estimation", kind: "list",
    items: [
      "QPS = DAU × requests per user per day ÷ 86,400",
      "Peak QPS ≈ 2–3 × average (10x for flash events)",
      "Storage/yr = writes/day × object size × 365 × replication",
      "Bandwidth = QPS × response size (× 8 for bits)",
      "Servers = peak QPS ÷ (per-server QPS × target utilisation ~0.6)",
      "Concurrency (Little's law) = throughput × latency",
      "Cache size ≈ 20% of daily read volume × object size (80/20 rule)",
      "Shards = max(writes ÷ per-shard writes, data ÷ per-shard size)",
      "Kafka partitions = max(throughput ÷ producer MB/s, throughput ÷ consumer MB/s)",
    ],
  },
  {
    title: "Component throughput (rough, per node)", tag: "numbers", kind: "table", head: ["Component", "Ballpark"],
    rows: [
      ["Nginx / Envoy (L7)", "10k–50k+ req/s"], ["Stateless app server", "1k–10k req/s"], ["Redis", "100k–1M ops/s"],
      ["Postgres / MySQL", "5k–20k simple writes/s, 10k–50k reads/s"], ["Cassandra / ScyllaDB", "10k–100k+ writes/s"],
      ["Kafka broker", "100+ MB/s, ~1M msgs/s"], ["Elasticsearch node", "1k–5k queries/s"], ["WebSocket gateway", "~100k–1M connections"],
      ["S3", "3.5k PUT / 5.5k GET per prefix per s"],
    ],
    note: "Always say 'roughly' and adjust for payload size and hardware.",
  },
  {
    title: "Choosing a datastore", tag: "data", kind: "table", head: ["Need", "Reach for"],
    rows: [
      ["Relations, transactions, ad-hoc queries", "PostgreSQL / MySQL"], ["Massive writes, wide rows, time series", "Cassandra, ScyllaDB, Bigtable"],
      ["Key-value at any scale, managed", "DynamoDB"], ["Flexible documents", "MongoDB"], ["Cache, counters, leaderboards, locks", "Redis"],
      ["Full-text / faceted search", "Elasticsearch / OpenSearch"], ["Analytics (OLAP)", "ClickHouse, BigQuery, Snowflake"],
      ["Blobs, media, backups", "S3 / GCS"], ["Graph traversals", "Neo4j / Neptune"], ["Global strong consistency", "Spanner, CockroachDB"],
      ["Event log / streaming", "Kafka, Kinesis, Pulsar"], ["Metrics time series", "Prometheus, InfluxDB, TimescaleDB"],
    ],
  },
  {
    title: "Caching patterns", tag: "caching", kind: "table", head: ["Pattern", "How", "Watch out"],
    rows: [
      ["Cache-aside", "App reads cache → DB on miss → SET", "Stale window; miss penalty"],
      ["Read-through", "Cache loads from DB", "Cache becomes critical"],
      ["Write-through", "Write cache + DB together", "Write latency; cold data cached"],
      ["Write-behind", "Write cache, flush async", "Data loss on crash"],
      ["Write-around", "Write DB only", "First read always misses"],
      ["Refresh-ahead", "Refresh hot keys before TTL", "Wasted refreshes"],
    ],
    note: "On update: write DB, then DELETE the key. Jitter TTLs. Coalesce misses (single-flight).",
  },
  {
    title: "Load balancing algorithms", tag: "networking", kind: "table", head: ["Algorithm", "Best for"],
    rows: [["Round robin", "Uniform requests"], ["Weighted RR", "Mixed instance sizes"], ["Least connections", "Variable request cost"],
      ["Least response time / EWMA", "Latency-sensitive"], ["Power of two choices", "Large fleets, no global state"],
      ["IP / consistent hash", "Affinity, cache locality"], ["Random", "Simple, surprisingly good"]],
  },
  {
    title: "Consistency models (strong → weak)", tag: "data", kind: "list",
    items: [
      "Linearizable: single-copy illusion, real-time order",
      "Sequential: one global order, not real-time",
      "Causal: cause before effect for everyone",
      "Read-your-writes: you see your own writes",
      "Monotonic reads: no going back in time",
      "Eventual: converges when writes stop",
    ],
    note: "Quorum rule: R + W > N gives overlapping read/write sets.",
  },
  {
    title: "CAP / PACELC quick map", tag: "data", kind: "table", head: ["System", "On partition", "Else"],
    rows: [["Spanner / CockroachDB", "C", "C (latency cost)"], ["DynamoDB / Cassandra", "A (tunable)", "L"], ["MongoDB (majority)", "C", "C"],
      ["Redis Cluster", "A-ish (async)", "L"], ["ZooKeeper / etcd", "C", "C"]],
  },
  {
    title: "Message delivery", tag: "async", kind: "table", head: ["Semantics", "How", "Cost"],
    rows: [["At-most-once", "Ack before processing", "May lose"], ["At-least-once", "Ack after processing", "Duplicates → idempotency"],
      ["Effectively-once", "Idempotent consumer / transactions", "Complexity"]],
    note: "Kafka orders within a partition. Key by entity id. Use a DLQ and the outbox pattern.",
  },
  {
    title: "Rate limiting algorithms", tag: "reliability", kind: "table", head: ["Algorithm", "Bursts", "Memory", "Accuracy"],
    rows: [["Token bucket", "Yes (bucket)", "O(1)", "Good"], ["Leaky bucket", "Smoothed", "O(1)", "Good"], ["Fixed window", "2x at edges", "O(1)", "Poor"],
      ["Sliding log", "No", "O(n)", "Exact"], ["Sliding counter", "Little", "O(1)", "Near-exact"]],
  },
  {
    title: "Resilience toolkit", tag: "reliability", kind: "list",
    items: [
      "Timeouts on every call; propagate deadlines",
      "Retries: idempotent only, exponential backoff + jitter, budgets",
      "Circuit breaker: closed → open → half-open",
      "Bulkheads: isolate pools per dependency",
      "Load shedding & backpressure",
      "Idempotency keys for writes",
      "Graceful degradation & fallbacks",
      "Health checks: liveness vs readiness",
    ],
  },
  {
    title: "Sharding strategies", tag: "data", kind: "table", head: ["Strategy", "Good", "Bad"],
    rows: [["Range", "Range scans", "Hot spots on monotonic keys"], ["Hash", "Even spread", "Scatter-gather ranges"],
      ["Consistent hash", "Minimal movement", "Needs vnodes"], ["Directory", "Flexible moves", "Lookup service SPOF"], ["Geo", "Residency, latency", "Uneven regions"]],
  },
  {
    title: "ID generation", tag: "data", kind: "table", head: ["Approach", "Notes"],
    rows: [["Auto-increment", "Simple, single node, guessable"], ["UUID v4", "128-bit, random, poor index locality"],
      ["UUID v7 / ULID", "Time-ordered, index friendly"], ["Snowflake (64-bit)", "41b time · 10b machine · 12b seq; ~4M ids/s/node"],
      ["Range allocation", "Lease blocks from a coordinator; base62 for short codes"]],
  },
  {
    title: "HTTP status codes to know", tag: "networking", kind: "table", head: ["Code", "Use"],
    rows: [["200 / 201 / 202", "OK / Created / Accepted (async)"], ["204", "No content"], ["301 / 302 / 307 / 308", "Redirects (permanent vs temporary)"],
      ["304", "Not modified (cache)"], ["400 / 401 / 403 / 404", "Bad request / unauth / forbidden / not found"], ["409", "Conflict (optimistic locking)"],
      ["429", "Rate limited (Retry-After)"], ["500 / 502 / 503 / 504", "Error / bad gateway / unavailable / timeout"]],
  },
  {
    title: "Interview framework", tag: "interview", kind: "list",
    items: [
      "1. Clarify: users, features in/out of scope, scale, SLAs",
      "2. Estimate: QPS (avg/peak), storage, bandwidth, read/write ratio",
      "3. API: endpoints or RPCs, pagination, idempotency",
      "4. Data model: entities, access patterns, store choice, shard key",
      "5. High level: client → edge → services → data → async",
      "6. Deep dives: the 2–3 hardest parts (hot keys, fan-out, consistency)",
      "7. Reliability: SPOFs, failover, multi-region, backpressure",
      "8. Wrap up: bottlenecks, monitoring, trade-offs, what's next",
    ],
    note: "Talk numbers. Name trade-offs explicitly. Drive the conversation.",
  },
  {
    title: "Classic designs in one line", tag: "interview", kind: "table", head: ["System", "Core idea"],
    rows: [
      ["URL shortener", "ID ranges + base62, KV store, cache-aside, async analytics"], ["News feed", "Hybrid fan-out; timeline cache; Snowflake ids"],
      ["Chat", "WebSockets + registry; per-conversation seq; store-and-forward"], ["Video", "Pre-signed upload → transcode DAG → HLS on CDN"],
      ["Ride sharing", "In-memory geo index (H3) + matching + trip state machine"], ["Rate limiter", "Token bucket in Redis via Lua; fail open"],
      ["Typeahead", "Trie / prefix index with top-k per node, cached at edge"], ["Web crawler", "URL frontier queues per host, politeness, dedupe (Bloom)"],
      ["Notification", "Per-channel queues, prefs, retries + DLQ, idempotency"], ["Distributed cache", "Consistent hashing + replication + LRU/TTL"],
    ],
  },
];
