import { C, type Lesson } from "./types";

export const foundations: Lesson[] = [
  {
    slug: "scalability-basics",
    track: "foundations",
    title: "From One Server to Many",
    subtitle: "Vertical vs horizontal scaling, statelessness, and the numbers that drive every design.",
    level: "beginner",
    minutes: 14,
    quizTopic: "scalability-basics",
    scene: {
      nodes: [
        { id: "u", type: "client", label: "Users", pos: [-6, 0] },
        { id: "lb", type: "lb", label: "Load Balancer", pos: [-2.5, 0] },
        { id: "s1", type: "server", label: "App #1", pos: [1, -3] },
        { id: "s2", type: "server", label: "App #2", pos: [1, 0] },
        { id: "s3", type: "server", label: "App #3", pos: [1, 3] },
        { id: "cache", type: "cache", label: "Session store", pos: [4.5, -2] },
        { id: "db", type: "db", label: "Database", pos: [4.5, 2] },
      ],
      edges: [["u", "lb"], ["lb", "s1"], ["lb", "s2"], ["lb", "s3"], ["s1", "db"], ["s2", "db"], ["s3", "db"], ["s1", "cache"], ["s2", "cache"], ["s3", "cache"]],
    },
    steps: [
      {
        title: "Everything on one box",
        body: "Every product starts here: one server runs the web app *and* the database. It is cheap and simple, but it has a hard ceiling and **one failure takes everything down**.",
        show: ["u", "s2"],
        edges: [["u", "s2"]],
        badges: { s2: "app + db" },
        flows: [["u", "s2", C.req, 1]],
      },
      {
        title: "Scale up (vertical)",
        body: "The first fix is a bigger machine: more cores, RAM, faster disks. It needs zero code changes, but price grows faster than capacity, there is a maximum size, and it is still a single point of failure.",
        show: ["u", "s2"],
        edges: [["u", "s2"]],
        hot: ["s2"],
        badges: { s2: "96 vCPU · 768 GB" },
        flows: [["u", "s2", C.req, 3]],
      },
      {
        title: "Split the tiers",
        body: "Move the database to its own machine. Web and data tiers now scale independently and the DB gets dedicated memory for its buffer cache.",
        show: ["u", "s2", "db"],
        edges: [["u", "s2"]],
        flows: [["u", "s2", C.req, 2], ["s2", "db", C.read, 1.5]],
      },
      {
        title: "Scale out (horizontal)",
        body: "Run **N identical app servers** behind a load balancer. Capacity grows roughly linearly and losing one box only removes 1/N of capacity. This only works if any server can handle any request.",
        show: ["u", "lb", "s1", "s2", "s3", "db"],
        flows: [["u", "lb", C.req, 3], ["lb", "s1", C.req, 1], ["lb", "s2", C.req, 1], ["lb", "s3", C.req, 1], ["s1", "db", C.read, 0.7], ["s2", "db", C.read, 0.7], ["s3", "db", C.read, 0.7]],
      },
      {
        title: "Make servers stateless",
        body: "If App #2 keeps your session in memory, the next request routed to App #3 logs you out. Push state out: sessions in a **shared store** (Redis) or a signed token on the client. Now servers are cattle, not pets.",
        down: ["s2"],
        flows: [["u", "lb", C.req, 3], ["lb", "s1", C.req, 1.5], ["lb", "s3", C.req, 1.5], ["s1", "cache", C.read, 1], ["s3", "cache", C.read, 1], ["s1", "db", C.read, 0.7], ["s3", "db", C.read, 0.7]],
      },
      {
        title: "The new bottleneck",
        body: "App servers are easy to clone; the database is not. Every request still lands on one DB. The rest of this course is about relieving that pressure: **caching, replication, sharding, queues**.",
        hot: ["db"],
        flows: [["u", "lb", C.req, 3], ["lb", "s1", C.req, 1], ["lb", "s2", C.req, 1], ["lb", "s3", C.req, 1], ["s1", "db", C.err, 1.2], ["s2", "db", C.err, 1.2], ["s3", "db", C.err, 1.2]],
      },
    ],
    sections: [
      {
        title: "Throughput, latency and utilisation",
        body: `**Throughput** is work per second (requests/s). **Latency** is time per request, and you should always talk in percentiles (p50, p95, p99), not averages.

Queueing theory explains why systems fall off a cliff: with utilisation ρ, waiting time grows like ρ/(1−ρ). At 50% load, requests wait about as long as they are served; at 90% they wait 9x longer. That is why production systems target **60–70% peak utilisation**.

#### Little's Law
Concurrency = throughput × latency. 2,000 req/s at 50 ms means ~100 requests in flight, so you need at least 100 worker threads or connections across the fleet.`,
      },
      {
        title: "Stateless vs stateful",
        body: `- **Stateless services** keep no per-user state between requests. Scale by adding replicas; deploy by rolling replacement.
- **Stateful services** (databases, caches, WebSocket gateways) own data or connections. Scaling them needs partitioning, replication and careful failover.
- Techniques: sessions in Redis, JWTs signed by the server, sticky routing only as a last resort, idempotent APIs so retries are safe.`,
      },
      {
        title: "Tail latency at scale",
        body: `When one page calls 50 services in parallel, the page is as slow as the slowest call. If each has a 1% chance of being slow, ~40% of pages are slow.

Mitigations: hedged requests (send a duplicate after the p95), timeouts per hop, load shedding, keeping hot paths shallow, and avoiding head-of-line blocking.`,
      },
    ],
    keyNumbers: [
      { label: "L1 cache reference", value: "~1 ns" },
      { label: "Main memory reference", value: "~100 ns" },
      { label: "Read 1 MB sequentially from memory", value: "~3 µs" },
      { label: "SSD random read", value: "~16 µs" },
      { label: "Round trip within datacenter", value: "~0.5 ms" },
      { label: "Read 1 MB from SSD", value: "~50 µs – 1 ms" },
      { label: "Disk seek (HDD)", value: "~2–10 ms" },
      { label: "Round trip US ↔ Europe", value: "~80–150 ms" },
      { label: "Seconds per day", value: "86,400 ≈ 10⁵" },
    ],
    tradeoffs: [
      { option: "Vertical scaling", pros: ["No code changes", "Strong consistency is trivial", "Low ops overhead"], cons: ["Hard hardware ceiling", "Non-linear cost", "Single point of failure", "Downtime to upgrade"] },
      { option: "Horizontal scaling", pros: ["Near-linear capacity", "Fault tolerance", "Commodity hardware", "Rolling deploys"], cons: ["Needs stateless design", "Distributed-systems complexity", "Network becomes part of every call"] },
    ],
    pitfalls: ["Designing for average load instead of peak (2–3x average is common)", "Keeping sessions in local memory", "Scaling app servers while the database is the bottleneck", "Ignoring p99 latency"],
    interview: ["Always state assumptions: DAU, read/write ratio, peak factor.", "Say where state lives before drawing boxes.", "Name the first bottleneck and how you would see it in metrics."],
    lab: [{ href: "/lab?challenge=hello-scale", label: "Challenge: Hello, Scale" }],
  },

  {
    slug: "load-balancing",
    track: "foundations",
    title: "Load Balancing",
    subtitle: "Spreading traffic, health checks, L4 vs L7, and algorithms that actually matter.",
    level: "beginner",
    minutes: 16,
    quizTopic: "load-balancing",
    scene: {
      nodes: [
        { id: "u", type: "client", label: "Users", pos: [-6, 0] },
        { id: "dns", type: "dns", label: "DNS", pos: [-6, -3.5] },
        { id: "lb", type: "lb", label: "LB (active)", pos: [-2.3, 0] },
        { id: "lb2", type: "lb", label: "LB (standby)", pos: [-2.3, 3.5] },
        { id: "a", type: "server", label: "App A", pos: [1.8, -3.2] },
        { id: "b", type: "server", label: "App B", pos: [1.8, 0] },
        { id: "c", type: "server", label: "App C", pos: [1.8, 3.2] },
      ],
      edges: [["u", "lb"], ["lb", "a"], ["lb", "b"], ["lb", "c"], ["u", "dns"], ["lb2", "a"], ["lb2", "b"], ["lb2", "c"]],
    },
    steps: [
      {
        title: "One address, many servers",
        body: "Clients resolve one hostname to the load balancer's IP. The LB holds a pool of backends and forwards each request (or connection) to one of them.",
        show: ["u", "dns", "lb", "a", "b", "c"],
        flows: [["u", "dns", C.vote, 0.5], ["u", "lb", C.req, 2.5], ["lb", "a", C.req, 1], ["lb", "b", C.req, 1], ["lb", "c", C.req, 1]],
      },
      {
        title: "Round robin",
        body: "The simplest algorithm: A, B, C, A, B, C… Perfect when requests cost the same and servers are identical. Weighted round robin gives bigger machines more turns.",
        show: ["u", "lb", "a", "b", "c"],
        badges: { a: "1, 4, 7", b: "2, 5, 8", c: "3, 6, 9" },
        flows: [["u", "lb", C.req, 2.5], ["lb", "a", C.req, 1], ["lb", "b", C.req, 1], ["lb", "c", C.req, 1]],
      },
      {
        title: "Least connections",
        body: "Real requests are not equal: an export takes 8 s, a profile read 8 ms. **Least-connections** (or least outstanding requests) sends new work to whoever is least busy, so B stops getting piled on.",
        show: ["u", "lb", "a", "b", "c"],
        hot: ["b"],
        badges: { a: "3 active", b: "41 active", c: "2 active" },
        flows: [["u", "lb", C.req, 2.5], ["lb", "a", C.req, 1.6], ["lb", "c", C.req, 1.6], ["lb", "b", C.req, 0.2]],
      },
      {
        title: "Health checks route around failure",
        body: "The LB probes `GET /health` every few seconds. When App B stops answering it is ejected from the pool and users never see the failure. Passive checks (5xx rate, timeouts) catch gray failures active probes miss.",
        show: ["u", "lb", "a", "b", "c"],
        down: ["b"],
        flows: [["u", "lb", C.req, 2.5], ["lb", "a", C.req, 1.5], ["lb", "c", C.req, 1.5]],
      },
      {
        title: "The balancer must not be a SPOF",
        body: "A single LB is a single point of failure. Run a pair with a floating virtual IP (VRRP / keepalived), or use a managed LB that is redundant across zones. DNS can also list several LB IPs.",
        down: ["lb"],
        flows: [["u", "lb2", C.req, 2.5], ["lb2", "a", C.req, 1], ["lb2", "b", C.req, 1], ["lb2", "c", C.req, 1]],
        edges: [["u", "lb2"]],
      },
    ],
    sections: [
      {
        title: "L4 vs L7",
        body: `**Layer 4** balancers route TCP/UDP connections by IP and port. They are fast, protocol-agnostic and cheap (NLB, IPVS, Maglev).

**Layer 7** balancers terminate HTTP(S) and understand requests: route \`/api/*\` to one pool and \`/static/*\` to another, inject headers, retry idempotent requests, enforce rate limits, do canary splits. Examples: Nginx, Envoy, HAProxy, ALB.

Typical stack: DNS → L4 (anycast) → L7 proxies → services.`,
      },
      {
        title: "Algorithms",
        body: `- **Round robin / weighted RR**: uniform work, simple.
- **Least connections / least outstanding requests**: uneven request cost.
- **Power of two choices**: pick 2 random backends, choose the less loaded. Near-optimal with no global state.
- **IP hash / consistent hash**: same client or key → same backend (cache locality, sticky sessions).
- **EWMA latency**: prefer backends that are responding fastest (Finagle, Linkerd).`,
      },
      {
        title: "Production details",
        body: `- **Connection draining**: on deploy, stop sending new requests and let in-flight ones finish.
- **Slow start**: ramp traffic to new instances so cold caches and JIT warm up.
- **Timeouts and retries**: retry only idempotent requests, with budgets, to avoid amplifying an outage.
- **TLS termination** at the LB centralises certificates; re-encrypt to backends if required.
- **Global load balancing**: GeoDNS or anycast sends users to the nearest healthy region.`,
      },
    ],
    keyNumbers: [
      { label: "Health check interval", value: "5–10 s, 2–3 failures to eject" },
      { label: "L4 LB throughput", value: "millions of packets/s per node" },
      { label: "Added latency (L7 proxy)", value: "~0.2–1 ms" },
    ],
    tradeoffs: [
      { option: "L4", pros: ["Very fast", "Any protocol", "Simple"], cons: ["No content routing", "No HTTP retries / header logic"] },
      { option: "L7", pros: ["Path/header routing", "Retries, auth, rate limits", "Observability per request"], cons: ["More CPU", "TLS termination cost", "More complex"] },
    ],
    pitfalls: ["Sticky sessions hiding stateful servers", "Retry storms when a backend slows down", "Health checks that only test 'process alive' not 'can reach DB'"],
    interview: ["Mention health checks and how failover works.", "Pick an algorithm and say why.", "Remove the LB as a SPOF."],
    lab: [{ href: "/lab?challenge=no-spof", label: "Challenge: Kill Anything" }],
  },

  {
    slug: "caching",
    track: "foundations",
    title: "Caching",
    subtitle: "Cache-aside, write strategies, eviction, invalidation and stampedes.",
    level: "intermediate",
    minutes: 20,
    quizTopic: "caching",
    scene: {
      nodes: [
        { id: "u", type: "client", label: "Users", pos: [-6, 0] },
        { id: "lb", type: "lb", label: "LB", pos: [-3, 0] },
        { id: "app", type: "server", label: "App", pos: [0, 0] },
        { id: "cache", type: "cache", label: "Redis", pos: [3.5, -2.5] },
        { id: "db", type: "db", label: "Database", pos: [3.5, 2.5] },
      ],
      edges: [["u", "lb"], ["lb", "app"], ["app", "cache"], ["app", "db"]],
    },
    steps: [
      {
        title: "Every read hits the database",
        body: "Without a cache, the same popular rows are read from disk thousands of times per second. The database spends its capacity re-answering identical questions.",
        show: ["u", "lb", "app", "db"],
        hot: ["db"],
        flows: [["u", "lb", C.req, 3], ["lb", "app", C.req, 3], ["app", "db", C.read, 3]],
      },
      {
        title: "Cache hit",
        body: "**Cache-aside**: the app first asks Redis. On a hit (~1 ms, from memory) it returns immediately. With a 90% hit rate, the database sees only 10% of reads.",
        badges: { cache: "HIT 90%" },
        flows: [["u", "lb", C.req, 3], ["lb", "app", C.req, 3], ["app", "cache", C.ok, 2.8], ["app", "db", C.read, 0.3]],
      },
      {
        title: "Cache miss",
        body: "On a miss the app reads the database, then **writes the result into the cache** with a TTL so the next reader gets a hit. The cache only holds data that was actually requested.",
        focus: ["db"],
        badges: { cache: "MISS → SET" },
        flows: [["app", "cache", C.err, 1], ["app", "db", C.read, 1.2]],
      },
      {
        title: "Writes and invalidation",
        body: "On update, write the database then **delete the cache key** (don't update it: two racing writers can leave stale data). Short TTLs bound how long staleness can last.",
        badges: { db: "UPDATE", cache: "DEL key" },
        flows: [["app", "db", C.write, 1.5], ["app", "cache", C.write, 1]],
      },
      {
        title: "Stampede when the cache dies",
        body: "If Redis restarts or a hot key expires, every request falls through at once: a **thundering herd** that can take down the database. Defences: request coalescing, locks, stale-while-revalidate, jittered TTLs, warm standby replicas.",
        down: ["cache"],
        hot: ["db"],
        flows: [["u", "lb", C.req, 3], ["lb", "app", C.req, 3], ["app", "db", C.err, 3]],
      },
    ],
    sections: [
      {
        title: "Read strategies",
        body: `- **Cache-aside (lazy loading)**: app manages the cache. Resilient (cache down ⇒ slower, not broken). Most common.
- **Read-through**: the cache library loads from the DB on miss. Cleaner app code, cache becomes a dependency.
- **Refresh-ahead**: proactively refresh hot keys before expiry to avoid miss latency spikes.`,
      },
      {
        title: "Write strategies",
        body: `- **Write-through**: write cache and DB synchronously. Cache always fresh; higher write latency; caches data that may never be read.
- **Write-around**: write DB only; cache fills on read. Good for write-once, read-rarely data.
- **Write-back (write-behind)**: write cache, flush to DB asynchronously. Very fast writes, risk of loss on crash. Used in CPU caches, some counters.`,
      },
      {
        title: "Eviction policies",
        body: `- **LRU**: evict least recently used. Great default, vulnerable to scans.
- **LFU**: evict least frequently used. Keeps long-term hot keys, slow to adapt.
- **W-TinyLFU** (Caffeine): a frequency sketch decides admission. Scan resistant, near-optimal hit rates.
- **TTL**: time-based expiry bounds staleness regardless of policy.

Try them side by side in the Algorithm Lab.`,
      },
      {
        title: "Failure modes",
        body: `- **Stampede / thundering herd**: many misses for one key at once → single-flight locks, early probabilistic refresh.
- **Penetration**: requests for keys that never exist → cache negative results, Bloom filter.
- **Avalanche**: many keys expire together → jitter TTLs.
- **Hot key**: one key saturates one shard → replicate it, local in-process cache, key splitting.
- **Inconsistency**: delete-after-write, versioned keys, or CDC-driven invalidation (Debezium → Kafka → cache).`,
      },
    ],
    keyNumbers: [
      { label: "Redis GET latency (same AZ)", value: "~0.2–1 ms" },
      { label: "Redis ops/s per node", value: "~100k–1M" },
      { label: "Typical target hit rate", value: "90–99%" },
      { label: "DB load at 95% hit rate", value: "1/20 of reads" },
    ],
    tradeoffs: [
      { option: "Cache-aside", pros: ["Simple", "Cache failure is survivable", "Only caches requested data"], cons: ["Miss penalty (3 trips)", "Stale data window"] },
      { option: "Write-through", pros: ["Cache always consistent with DB"], cons: ["Slower writes", "Caches cold data"] },
      { option: "Write-back", pros: ["Fastest writes", "Batches DB writes"], cons: ["Data loss on crash", "Complex"] },
    ],
    pitfalls: ["Caching without TTLs", "Updating cache on write (race) instead of deleting", "No plan for cache cold start", "Caching user-specific data under a shared key"],
    interview: ["State hit rate assumptions and how much DB load remains.", "Pick a write strategy and an invalidation approach.", "Mention stampede protection."],
    lab: [
      { href: "/lab?challenge=read-heavy-feed", label: "Challenge: Read-Heavy Feed" },
      { href: "/lab?challenge=cache-stampede", label: "Challenge: Cache Stampede" },
      { href: "/lab/algorithms?tab=cache", label: "Eviction policy lab" },
    ],
  },

  {
    slug: "cdn",
    track: "foundations",
    title: "CDNs & the Edge",
    subtitle: "Moving bytes closer to users: pull vs push, cache keys, shields and invalidation.",
    level: "beginner",
    minutes: 12,
    quizTopic: "cdn",
    scene: {
      nodes: [
        { id: "eu", type: "client", label: "Users · Europe", pos: [-6, -3] },
        { id: "as", type: "client", label: "Users · Asia", pos: [-6, 3] },
        { id: "e1", type: "cdn", label: "Edge Frankfurt", pos: [-2.5, -3] },
        { id: "e2", type: "cdn", label: "Edge Singapore", pos: [-2.5, 3] },
        { id: "shield", type: "cdn", label: "Origin shield", pos: [1, 0] },
        { id: "origin", type: "server", label: "Origin (us-east)", pos: [4.5, 0] },
        { id: "s3", type: "storage", label: "Object store", pos: [4.5, 3.5] },
      ],
      edges: [["eu", "e1"], ["as", "e2"], ["e1", "shield"], ["e2", "shield"], ["shield", "origin"], ["origin", "s3"]],
    },
    steps: [
      {
        title: "Physics wins",
        body: "Light in fibre covers ~200 km per ms. A user in Singapore talking to Virginia pays ~250 ms per round trip, and a TLS page load needs several. No amount of server tuning fixes distance.",
        show: ["eu", "as", "origin", "s3"],
        edges: [["eu", "origin"], ["as", "origin"]],
        badges: { as: "RTT 250 ms" },
        flows: [["eu", "origin", C.req, 1.5], ["as", "origin", C.err, 1.5]],
      },
      {
        title: "Edge PoPs",
        body: "A CDN runs hundreds of Points of Presence. DNS or anycast sends each user to the nearest one, ~5–20 ms away. TLS terminates there, and cached responses never cross the ocean.",
        show: ["eu", "as", "e1", "e2", "origin", "s3"],
        edges: [["e1", "origin"], ["e2", "origin"]],
        badges: { e1: "HIT", e2: "HIT" },
        flows: [["eu", "e1", C.ok, 2], ["as", "e2", C.ok, 2], ["e1", "origin", C.read, 0.3], ["e2", "origin", C.read, 0.3]],
      },
      {
        title: "Origin shield collapses misses",
        body: "When a new video goes viral, 300 edges miss at once. A **shield** tier makes every edge fetch through one mid-tier cache, so the origin sees one request instead of hundreds.",
        badges: { shield: "1 fetch" },
        flows: [["eu", "e1", C.req, 2], ["as", "e2", C.req, 2], ["e1", "shield", C.read, 1], ["e2", "shield", C.read, 1], ["shield", "origin", C.read, 0.4], ["origin", "s3", C.read, 0.4]],
      },
      {
        title: "Origin outage? Serve stale",
        body: "With `stale-if-error`, edges keep serving cached content when the origin is down. Popular content stays available while you fix things.",
        down: ["origin"],
        flows: [["eu", "e1", C.ok, 2], ["as", "e2", C.ok, 2], ["e1", "shield", C.ok, 0.8], ["e2", "shield", C.ok, 0.8]],
      },
    ],
    sections: [
      {
        title: "What to cache at the edge",
        body: `- **Static assets** (JS, CSS, fonts, images): fingerprint filenames (\`app.3f9a1c.js\`) and cache for a year with \`Cache-Control: public, max-age=31536000, immutable\`.
- **Media**: video segments, thumbnails. Most egress bytes in the world.
- **API responses**: public, cacheable GETs with short TTLs (\`s-maxage=30, stale-while-revalidate=60\`).
- **Never** cache personalised responses under a shared key. Use \`Vary\` carefully, or \`private\`.`,
      },
      {
        title: "Pull vs push",
        body: `**Pull CDN**: edges fetch from origin on first request. Zero setup, first user pays the miss.

**Push CDN**: you upload to the CDN ahead of time. Good for large catalogues with predictable demand (pre-positioned video at ISPs, game patches).`,
      },
      {
        title: "Invalidation",
        body: `Purges are eventually consistent across hundreds of PoPs, so design to avoid needing them: content-addressed URLs for assets, short TTLs + stale-while-revalidate for semi-dynamic content, and tag-based (surrogate key) purges for catalogue updates.`,
      },
      {
        title: "Edge compute",
        body: `Modern CDNs run code at the edge (Workers, Lambda@Edge): auth checks, A/B routing, header rewrites, image resizing, bot filtering and DDoS absorption all happen before traffic reaches you.`,
      },
    ],
    keyNumbers: [
      { label: "Speed of light in fibre", value: "~200 km/ms" },
      { label: "Edge RTT (typical)", value: "5–20 ms" },
      { label: "Intercontinental RTT", value: "100–250 ms" },
      { label: "Good static hit ratio", value: "95%+" },
    ],
    pitfalls: ["Caching Set-Cookie responses", "Cache keys that include random query params", "Relying on instant purges", "Forgetting the CDN for API-heavy, globally distributed apps"],
    interview: ["Put media and static assets on a CDN immediately.", "Estimate egress bandwidth and how much the CDN absorbs.", "Explain cache keys and invalidation."],
    lab: [{ href: "/lab?challenge=global-video", label: "Challenge: Global Video Platform" }],
  },
];
