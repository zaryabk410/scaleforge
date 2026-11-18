import { C, type Lesson } from "./types";

export const reliability: Lesson[] = [
  {
    slug: "queues",
    track: "reliability",
    title: "Queues & Event Streams",
    subtitle: "Decoupling, load leveling, delivery semantics, partitions and dead letters.",
    level: "intermediate",
    minutes: 18,
    quizTopic: "queues",
    scene: {
      nodes: [
        { id: "u", type: "client", label: "Producers", pos: [-6, 0] },
        { id: "api", type: "server", label: "API", pos: [-2.8, 0] },
        { id: "q", type: "queue", label: "Queue / Topic", pos: [0.8, 0] },
        { id: "w1", type: "worker", label: "Worker 1", pos: [4.2, -3] },
        { id: "w2", type: "worker", label: "Worker 2", pos: [4.2, 0] },
        { id: "w3", type: "worker", label: "Worker 3", pos: [4.2, 3] },
        { id: "db", type: "nosql", label: "Store", pos: [7.4, 0] },
        { id: "dlq", type: "queue", label: "Dead letters", pos: [0.8, 3.8] },
      ],
      edges: [["u", "api"], ["api", "q"], ["q", "w1"], ["q", "w2"], ["q", "w3"], ["w1", "db"], ["w2", "db"], ["w3", "db"], ["q", "dlq"]],
    },
    steps: [
      {
        title: "Synchronous chains are fragile",
        body: "If the API writes straight to storage, the user waits for the slowest step, and a slow database turns into timeouts for everyone.",
        show: ["u", "api", "db"],
        edges: [["api", "db"]],
        hot: ["db"],
        flows: [["u", "api", C.req, 3], ["api", "db", C.err, 3]],
      },
      {
        title: "Enqueue and acknowledge",
        body: "The API appends a message to a durable queue and returns `202 Accepted` in a few ms. The work happens later; the user is not blocked.",
        show: ["u", "api", "q"],
        badges: { q: "ACK 2 ms" },
        flows: [["u", "api", C.req, 3], ["api", "q", C.async, 3]],
      },
      {
        title: "Workers drain at their own pace",
        body: "Consumers pull messages and process them. Add workers to drain faster; during a spike the **backlog grows** instead of the database falling over (load leveling).",
        show: ["u", "api", "q", "w1", "w2", "w3", "db"],
        badges: { q: "backlog 12,400" },
        flows: [["u", "api", C.req, 3], ["api", "q", C.async, 3], ["q", "w1", C.async, 1], ["q", "w2", C.async, 1], ["q", "w3", C.async, 1], ["w1", "db", C.write, 0.9], ["w2", "db", C.write, 0.9], ["w3", "db", C.write, 0.9]],
      },
      {
        title: "Crashes and redelivery",
        body: "Worker 2 dies mid-message. It never acked, so after the visibility timeout the broker hands the message to another worker. That is **at-least-once** delivery, so processing must be **idempotent**.",
        down: ["w2"],
        show: ["u", "api", "q", "w1", "w2", "w3", "db"],
        flows: [["api", "q", C.async, 2], ["q", "w1", C.async, 1.5], ["q", "w3", C.async, 1.5], ["w1", "db", C.write, 1], ["w3", "db", C.write, 1]],
      },
      {
        title: "Poison messages → DLQ",
        body: "A malformed message fails every time. After N attempts it is moved to a **dead-letter queue** so it stops blocking the stream; engineers inspect and replay it after a fix.",
        focus: ["dlq"],
        flows: [["q", "dlq", C.err, 1], ["q", "w1", C.async, 1], ["q", "w2", C.async, 1], ["q", "w3", C.async, 1]],
      },
    ],
    sections: [
      {
        title: "Queue vs log",
        body: `- **Message queue** (SQS, RabbitMQ): each message goes to one consumer and is deleted after ack. Great for task distribution.
- **Log / stream** (Kafka, Kinesis, Pulsar): messages are appended to partitions and retained. Many consumer groups read independently, each tracking an offset; you can replay history.

Use a log when multiple systems react to the same events (analytics, search indexing, cache invalidation), or when you need replay.`,
      },
      {
        title: "Delivery semantics",
        body: `- **At-most-once**: ack before processing; may lose messages.
- **At-least-once**: ack after processing; may duplicate. The default.
- **Effectively-once**: at-least-once + idempotent consumers (dedupe by message id, upserts, conditional writes) or transactional processing (Kafka transactions).`,
      },
      {
        title: "Ordering & partitions",
        body: `Kafka orders messages **within a partition**. Key messages by entity (\`order_id\`) so all events for one entity are ordered; different entities proceed in parallel. Consumers in a group split partitions, so max parallelism = partition count.`,
      },
      {
        title: "Patterns",
        body: `- **Transactional outbox**: write the business row and an outbox row in one DB transaction; a relay publishes the outbox. Fixes the dual-write problem.
- **Competing consumers**: scale workers horizontally.
- **Backpressure**: bound queue size, shed or delay producers when consumers fall behind.
- **Retry with backoff** + **DLQ** for failures.
- **Event sourcing / CQRS**: the log is the source of truth; read models are projections.`,
      },
    ],
    keyNumbers: [
      { label: "Kafka partition throughput", value: "~10–50 MB/s" },
      { label: "Broker cluster", value: "millions of msgs/s" },
      { label: "SQS visibility timeout default", value: "30 s" },
    ],
    tradeoffs: [
      { option: "Synchronous", pros: ["Immediate result", "Simple errors"], cons: ["Latency of slowest dependency", "Cascading failures"] },
      { option: "Asynchronous", pros: ["Fast ACK", "Absorbs spikes", "Decoupled teams"], cons: ["Eventual consistency", "Harder debugging", "Duplicates"] },
    ],
    pitfalls: ["Non-idempotent consumers", "Unbounded queues hiding an outage", "Global ordering requirements that kill parallelism", "Dual writes without an outbox"],
    interview: ["Say what is sync vs async and why.", "Name delivery semantics and how you dedupe.", "Size partitions/workers from throughput."],
    lab: [{ href: "/lab?challenge=write-firehose", label: "Challenge: Telemetry Firehose" }],
  },

  {
    slug: "rate-limiting",
    track: "reliability",
    title: "Rate Limiting",
    subtitle: "Token buckets, windows, distributed counters and protecting yourself from your users.",
    level: "intermediate",
    minutes: 14,
    quizTopic: "rate-limiting",
    scene: {
      nodes: [
        { id: "good", type: "client", label: "Normal users", pos: [-6, -2.5] },
        { id: "bot", type: "client", label: "Abusive client", pos: [-6, 2.5] },
        { id: "gw", type: "gateway", label: "Gateway + limiter", pos: [-2, 0] },
        { id: "redis", type: "cache", label: "Counters (Redis)", pos: [-2, 4] },
        { id: "lb", type: "lb", label: "LB", pos: [1.6, 0] },
        { id: "app", type: "server", label: "Services", pos: [5, 0] },
      ],
      edges: [["good", "gw"], ["bot", "gw"], ["gw", "redis"], ["gw", "lb"], ["lb", "app"]],
    },
    steps: [
      {
        title: "One client can take everyone down",
        body: "A buggy script or scraper sends 50x normal traffic. Without limits it consumes capacity meant for every other user.",
        show: ["good", "bot", "lb", "app"],
        edges: [["good", "lb"], ["bot", "lb"]],
        hot: ["app"],
        flows: [["good", "lb", C.req, 1], ["bot", "lb", C.err, 3], ["lb", "app", C.err, 3]],
      },
      {
        title: "Token bucket",
        body: "Each key (user, API key, IP) has a bucket of N tokens refilled at rate r. A request spends one token; an empty bucket means `429 Too Many Requests`. Bursts up to N are allowed, the average is capped at r.",
        badges: { gw: "10 tok · 5/s" },
        flows: [["good", "gw", C.req, 1], ["bot", "gw", C.err, 3], ["gw", "lb", C.ok, 1.2], ["lb", "app", C.ok, 1.2]],
      },
      {
        title: "Shared counters across gateways",
        body: "With 50 gateway instances, limits must be shared. Each check runs an atomic script in Redis (`INCR` + `EXPIRE`, or a Lua token bucket) so racing gateways cannot double-spend.",
        focus: ["redis"],
        flows: [["gw", "redis", C.vote, 1.5], ["good", "gw", C.req, 1], ["bot", "gw", C.err, 2], ["gw", "lb", C.ok, 1.2]],
      },
      {
        title: "Fail open",
        body: "If Redis is down, should every request be rejected? Usually not: **fail open** (allow, maybe with a local in-memory limiter) for availability, fail closed only for security-critical limits like login attempts.",
        down: ["redis"],
        flows: [["good", "gw", C.req, 1], ["bot", "gw", C.req, 1.5], ["gw", "lb", C.req, 2], ["lb", "app", C.req, 2]],
      },
    ],
    sections: [
      {
        title: "Algorithms compared",
        body: `- **Token bucket**: allows bursts, smooth average. O(1) state. Default choice (AWS, Stripe).
- **Leaky bucket**: constant outflow, shapes traffic. Good in front of fragile downstreams.
- **Fixed window counter**: count per minute. Simplest; up to 2x burst at window edges.
- **Sliding window log**: store timestamps; exact, memory heavy.
- **Sliding window counter**: weighted current + previous window. Near-exact, O(1). Cloudflare's choice.

Run all five against the same traffic in the **Rate limiter lab**.`,
      },
      {
        title: "Where to enforce",
        body: `- **Edge / CDN / WAF**: IP-level, DDoS.
- **API gateway**: per API key / user / route.
- **Service level**: protect expensive endpoints; concurrency limits.
- **Client side**: SDKs that respect \`Retry-After\` and back off.

Return \`429\` with \`Retry-After\`, \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`.`,
      },
      {
        title: "Beyond request counts",
        body: `- **Concurrency limits**: max in-flight requests (adaptive, like Netflix's concurrency-limits).
- **Load shedding**: drop low-priority traffic when CPU or queue depth is high.
- **Quotas**: daily/monthly usage for billing tiers.
- **Cost-based limits**: expensive queries spend more tokens.`,
      },
    ],
    keyNumbers: [
      { label: "Redis round trip per check", value: "~0.3–1 ms" },
      { label: "Memory per key (counter)", value: "~50–100 B" },
    ],
    pitfalls: ["Fixed windows letting 2x bursts through", "Non-atomic read-then-write counters", "Limiting by IP behind NAT / proxies", "Failing closed on limiter outage"],
    interview: ["Pick an algorithm and justify burst behaviour.", "Explain distributed counting and failure mode.", "Mention client headers."],
    lab: [{ href: "/lab/algorithms?tab=ratelimit", label: "Rate limiter lab" }],
  },

  {
    slug: "microservices",
    track: "reliability",
    title: "Microservices & Resilience",
    subtitle: "Gateways, service discovery, timeouts, retries, circuit breakers, bulkheads and sagas.",
    level: "advanced",
    minutes: 20,
    quizTopic: "microservices",
    scene: {
      nodes: [
        { id: "u", type: "client", label: "Clients", pos: [-6.5, 0] },
        { id: "gw", type: "gateway", label: "API Gateway", pos: [-3, 0] },
        { id: "orders", type: "server", label: "Orders", pos: [0.5, -3] },
        { id: "users", type: "server", label: "Users", pos: [0.5, 0] },
        { id: "pay", type: "server", label: "Payments", pos: [0.5, 3] },
        { id: "odb", type: "db", label: "Orders DB", pos: [4, -3] },
        { id: "udb", type: "nosql", label: "Users DB", pos: [4, 0] },
        { id: "ext", type: "server", label: "Card provider", pos: [4, 3] },
        { id: "bus", type: "queue", label: "Event bus", pos: [4, 6] },
      ],
      edges: [["u", "gw"], ["gw", "orders"], ["gw", "users"], ["orders", "odb"], ["users", "udb"], ["orders", "pay"], ["pay", "ext"], ["orders", "bus"], ["pay", "bus"]],
    },
    steps: [
      {
        title: "One gateway, many services",
        body: "Each service owns its data and deploys independently. The **API gateway** is the front door: TLS, auth, routing, rate limits, request aggregation.",
        show: ["u", "gw", "orders", "users", "odb", "udb"],
        flows: [["u", "gw", C.req, 2], ["gw", "orders", C.req, 1], ["gw", "users", C.req, 1], ["orders", "odb", C.read, 0.8], ["users", "udb", C.read, 0.8]],
      },
      {
        title: "A slow dependency spreads",
        body: "The card provider slows to 30 s. Payments threads block waiting, Orders threads block waiting on Payments, and soon the gateway's connection pool is full: a **cascading failure** from one external call.",
        hot: ["ext", "pay", "orders"],
        show: ["u", "gw", "orders", "users", "pay", "odb", "udb", "ext"],
        flows: [["u", "gw", C.req, 2], ["gw", "orders", C.err, 1.5], ["orders", "pay", C.err, 1.5], ["pay", "ext", C.err, 1.5], ["gw", "users", C.req, 0.4]],
      },
      {
        title: "Timeouts + circuit breaker",
        body: "Every call gets a **timeout**. When failures cross a threshold, the **circuit opens**: Payments fails fast for 30 s instead of waiting, then half-opens to probe recovery. Orders degrades gracefully (\"payment pending\").",
        down: ["ext"],
        show: ["u", "gw", "orders", "users", "pay", "odb", "udb", "ext"],
        badges: { pay: "circuit OPEN" },
        flows: [["u", "gw", C.req, 2], ["gw", "orders", C.req, 1], ["gw", "users", C.req, 1], ["orders", "pay", C.ok, 0.8], ["orders", "odb", C.write, 0.8]],
      },
      {
        title: "Sagas instead of distributed transactions",
        body: "Placing an order spans Orders and Payments. Each does a local transaction and publishes an event. If payment fails, a **compensating action** cancels the order. No global locks, eventual consistency.",
        flows: [["orders", "bus", C.async, 1], ["bus", "pay", C.async, 1], ["pay", "bus", C.async, 1], ["orders", "odb", C.write, 0.6]],
        edges: [["bus", "pay"]],
      },
    ],
    sections: [
      {
        title: "Resilience toolkit",
        body: `- **Timeouts** on every network call, shorter than the caller's own timeout (deadline propagation).
- **Retries** only for idempotent ops, with exponential backoff + jitter and a retry budget (e.g. ≤ 10% extra load).
- **Circuit breakers**: closed → open → half-open.
- **Bulkheads**: separate thread/connection pools per dependency so one can't starve the others.
- **Fallbacks**: cached data, defaults, degraded features.
- **Idempotency keys** so client retries never double-charge.`,
      },
      {
        title: "Service discovery & mesh",
        body: `Instances come and go, so services find each other through a registry (Consul, etcd, Kubernetes DNS/Endpoints). A **service mesh** (Envoy sidecars via Istio/Linkerd) moves mTLS, retries, timeouts, circuit breaking and telemetry out of application code.`,
      },
      {
        title: "Data ownership",
        body: `Each service owns its tables; others access them only through its API or its events. Shared databases recreate the monolith's coupling. Replicate data you need via events (materialised views), accepting eventual consistency.`,
      },
      {
        title: "When not to",
        body: `Microservices trade code complexity for operational complexity. For small teams a **modular monolith** with clear module boundaries is usually faster. Split when teams, deploy cadence or scaling needs genuinely diverge.`,
      },
    ],
    tradeoffs: [
      { option: "Monolith", pros: ["Simple deploys", "Easy transactions", "Fast local calls"], cons: ["Scaling is all-or-nothing", "Team coupling"] },
      { option: "Microservices", pros: ["Independent deploy & scale", "Fault isolation", "Team autonomy"], cons: ["Network failures everywhere", "Distributed data", "Ops overhead"] },
    ],
    pitfalls: ["No timeouts (default infinite)", "Retrying at every layer (multiplicative storms)", "Distributed monolith with shared DB", "Synchronous chains 6 services deep"],
    interview: ["Draw the critical path and its timeouts.", "Mention circuit breakers and idempotency.", "Use sagas for cross-service workflows."],
    lab: [{ href: "/lab", label: "Open the simulator" }],
  },

  {
    slug: "observability",
    track: "reliability",
    title: "Observability & SLOs",
    subtitle: "Metrics, logs, traces, SLIs/SLOs, error budgets and availability math.",
    level: "intermediate",
    minutes: 14,
    quizTopic: "observability",
    scene: {
      nodes: [
        { id: "u", type: "client", label: "Users", pos: [-6, 0] },
        { id: "gw", type: "gateway", label: "Gateway", pos: [-2.5, 0] },
        { id: "a", type: "server", label: "Service A", pos: [1, -2] },
        { id: "b", type: "server", label: "Service B", pos: [1, 2] },
        { id: "db", type: "db", label: "DB", pos: [4.5, 2] },
        { id: "obs", type: "search", label: "Metrics · Logs · Traces", pos: [4.5, -2.5] },
      ],
      edges: [["u", "gw"], ["gw", "a"], ["gw", "b"], ["b", "db"], ["a", "obs"], ["b", "obs"], ["gw", "obs"]],
    },
    steps: [
      {
        title: "Instrument every hop",
        body: "Each service emits **metrics** (counters, histograms), structured **logs**, and **trace spans** sharing a trace id propagated in headers (W3C `traceparent`).",
        flows: [["u", "gw", C.req, 2], ["gw", "a", C.req, 1], ["gw", "b", C.req, 1], ["b", "db", C.read, 1], ["a", "obs", C.async, 0.6], ["b", "obs", C.async, 0.6], ["gw", "obs", C.async, 0.6]],
      },
      {
        title: "Find the slow span",
        body: "p99 jumps. The trace waterfall shows the gateway waiting 900 ms on Service B, which waits on a DB query missing an index. Metrics say *something* is wrong; traces say *where*.",
        hot: ["db", "b"],
        badges: { b: "870 ms", db: "seq scan" },
        flows: [["gw", "b", C.err, 1], ["b", "db", C.err, 1], ["b", "obs", C.async, 1]],
      },
      {
        title: "SLOs and error budgets",
        body: "Define an SLI (\"% of requests < 300 ms and non-5xx\") and an SLO (99.9% over 30 days). The remaining 0.1% is the **error budget**: spend it on launches; when it's gone, prioritise reliability.",
        badges: { gw: "SLO 99.9%", obs: "budget 62% left" },
        flows: [["u", "gw", C.ok, 2], ["gw", "a", C.ok, 1], ["gw", "b", C.ok, 1]],
      },
    ],
    sections: [
      {
        title: "What to measure",
        body: `- **RED** for services: Rate, Errors, Duration.
- **USE** for resources: Utilisation, Saturation, Errors.
- **Golden signals**: latency, traffic, errors, saturation.
- Use **histograms** for latency (percentiles cannot be averaged across hosts).`,
      },
      {
        title: "Availability math",
        body: `- Serial dependencies multiply: two 99.9% services in series ≈ 99.8%.
- Redundant copies add nines: 1 − (1 − 0.99)² = 99.99% for two independent 99% replicas.
- 99.9% ≈ 43 min/month, 99.99% ≈ 4.3 min/month, 99.999% ≈ 26 s/month.`,
      },
      {
        title: "Alerting",
        body: `Page on **symptoms** users feel (SLO burn rate), not causes (CPU 80%). Multi-window burn-rate alerts (e.g. 2% of budget in 1 h, 5% in 6 h) catch both sudden outages and slow leaks with little noise. Everything else becomes a ticket or a dashboard.`,
      },
    ],
    keyNumbers: [
      { label: "99.9% monthly downtime", value: "~43 min" },
      { label: "99.99% monthly downtime", value: "~4.3 min" },
      { label: "99.999% monthly downtime", value: "~26 s" },
    ],
    pitfalls: ["Averages instead of percentiles", "Alerting on every metric", "Logs without request/trace ids", "Unbounded label cardinality in metrics"],
    interview: ["State SLOs for the key user journeys.", "Explain how you'd detect and localise a regression."],
  },
];
