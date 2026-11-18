import { C, type Lesson } from "./types";

export const cases: Lesson[] = [
  {
    slug: "url-shortener",
    track: "case-studies",
    title: "Case Study: URL Shortener",
    subtitle: "A read-heavy KV service with ID generation, caching and async analytics.",
    level: "intermediate",
    minutes: 22,
    quizTopic: "url-shortener",
    scene: {
      nodes: [
        { id: "u", type: "client", label: "Users", pos: [-7, 0] },
        { id: "cdn", type: "cdn", label: "Edge", pos: [-4, 0] },
        { id: "lb", type: "lb", label: "LB", pos: [-1, 0] },
        { id: "app", type: "server", label: "Shortener API", pos: [2, 0] },
        { id: "ids", type: "server", label: "ID ranges", pos: [2, -3.5] },
        { id: "cache", type: "cache", label: "Redis", pos: [5.2, -2.2] },
        { id: "kv", type: "nosql", label: "code → url", pos: [5.2, 1.4] },
        { id: "q", type: "queue", label: "Click events", pos: [2, 3.8] },
        { id: "olap", type: "storage", label: "Analytics", pos: [5.2, 4.6] },
      ],
      edges: [["u", "cdn"], ["cdn", "lb"], ["lb", "app"], ["app", "ids"], ["app", "cache"], ["app", "kv"], ["app", "q"], ["q", "olap"]],
    },
    steps: [
      {
        title: "Requirements & scale",
        body: "Create short links and redirect fast. ~100M new links/month (≈40 writes/s) and 100:1 reads (≈4k/s average, ~12k/s peak). Five years ≈ 6B links × ~500 B ≈ **3 TB**. This is a read-heavy key-value problem.",
        show: ["u", "app", "kv"],
        edges: [["u", "app"]],
        flows: [["u", "app", C.req, 2], ["app", "kv", C.read, 2]],
      },
      {
        title: "Generating codes",
        body: "Each API server leases a **range of IDs** (e.g. 1,000,000–1,000,999) from a coordinator and base62-encodes them. 7 base62 chars ≈ 3.5 trillion codes. No collision checks, no per-write coordination.",
        show: ["u", "lb", "app", "ids", "kv"],
        edges: [["u", "lb"]],
        focus: ["ids"],
        badges: { ids: "lease 1000 ids" },
        flows: [["u", "lb", C.write, 1], ["lb", "app", C.write, 1], ["app", "ids", C.vote, 0.4], ["app", "kv", C.write, 1]],
      },
      {
        title: "The redirect path",
        body: "`GET /aZ3kQ9` → cache-aside lookup → `302` to the long URL. Hot links live in Redis; edge caching with a short TTL absorbs viral spikes. Redirect latency is a few ms server-side.",
        show: ["u", "cdn", "lb", "app", "cache", "kv"],
        badges: { cache: "hit 95%" },
        flows: [["u", "cdn", C.req, 3], ["cdn", "lb", C.req, 1.5], ["lb", "app", C.req, 1.5], ["app", "cache", C.ok, 1.4], ["app", "kv", C.read, 0.2]],
      },
      {
        title: "Analytics off the hot path",
        body: "Each redirect publishes a click event to a queue; consumers aggregate into an analytics store. The redirect never waits on analytics.",
        flows: [["u", "cdn", C.req, 2], ["cdn", "lb", C.req, 1.2], ["lb", "app", C.req, 1.2], ["app", "cache", C.ok, 1], ["app", "q", C.async, 1], ["q", "olap", C.async, 1]],
      },
    ],
    sections: [
      {
        title: "API",
        body: `- \`POST /api/urls { long_url, alias?, expires_at? } → { code, short_url }\`
- \`GET /{code} → 302 Location: long_url\` (use \`301\` only if you don't need analytics: browsers cache it)
- \`GET /api/urls/{code}/stats\``,
      },
      {
        title: "Data model",
        body: `\`urls(code PK, long_url, owner_id, created_at, expires_at)\` in a KV/wide-column store partitioned by \`code\`. Secondary index \`owner_id → codes\` for "my links". Optionally dedupe by storing \`hash(long_url) → code\`.`,
      },
      {
        title: "Code generation options",
        body: `- **Counter ranges + base62** (recommended): unique, compact, cheap.
- **Snowflake IDs**: no coordinator, longer codes.
- **Hash of URL** (MD5 → first 7 chars): deterministic, needs collision handling.
- **Random**: needs existence check; unguessable.

If predictability matters, shuffle IDs with a reversible permutation (e.g. Feistel) before encoding.`,
      },
      {
        title: "Deep dives",
        body: `- **Expiry**: lazy delete on read + periodic sweeper.
- **Abuse**: rate-limit creation, scan against malware lists, CAPTCHAs.
- **Multi-region**: replicate the KV store; reads local, writes to the home region.
- **Custom aliases**: conditional insert (\`IF NOT EXISTS\`).`,
      },
    ],
    keyNumbers: [
      { label: "Writes", value: "~40/s avg" },
      { label: "Reads", value: "~4k/s avg, ~12k/s peak" },
      { label: "Storage (5 yrs)", value: "~3 TB" },
      { label: "7-char base62 space", value: "62⁷ ≈ 3.5 × 10¹²" },
    ],
    interview: ["Start with the read path; it dominates.", "Explain 301 vs 302.", "Show how codes are generated without coordination per write."],
    lab: [{ href: "/lab?template=url-shortener", label: "Load reference design into the lab" }, { href: "/practice?tab=interviews&id=url-shortener", label: "Mock interview" }],
  },

  {
    slug: "news-feed",
    track: "case-studies",
    title: "Case Study: News Feed",
    subtitle: "Fan-out on write vs read, the celebrity problem, and timeline caches.",
    level: "advanced",
    minutes: 25,
    quizTopic: "news-feed",
    scene: {
      nodes: [
        { id: "u", type: "client", label: "Apps", pos: [-7, 0] },
        { id: "gw", type: "gateway", label: "API Gateway", pos: [-4, 0] },
        { id: "post", type: "server", label: "Post service", pos: [-0.8, 3] },
        { id: "tl", type: "server", label: "Timeline service", pos: [-0.8, -3] },
        { id: "q", type: "queue", label: "Fan-out queue", pos: [2.6, 3] },
        { id: "fan", type: "worker", label: "Fan-out workers", pos: [6, 3] },
        { id: "tc", type: "cache", label: "Timeline cache", pos: [6, -3] },
        { id: "tweets", type: "nosql", label: "Post store", pos: [2.6, 0] },
        { id: "graph", type: "db", label: "Social graph", pos: [6, 0] },
      ],
      edges: [["u", "gw"], ["gw", "post"], ["gw", "tl"], ["post", "tweets"], ["post", "q"], ["q", "fan"], ["fan", "graph"], ["fan", "tc"], ["tl", "tc"], ["tl", "tweets"]],
    },
    steps: [
      {
        title: "Fan-out on read (pull)",
        body: "To build Alice's feed, fetch the latest posts of everyone she follows and merge them. Writes are cheap, but every feed load queries hundreds of timelines: **slow reads** at 300k feed loads/s.",
        show: ["u", "gw", "tl", "tweets", "graph"],
        edges: [["tl", "graph"]],
        hot: ["tweets"],
        flows: [["u", "gw", C.req, 2], ["gw", "tl", C.req, 2], ["tl", "graph", C.read, 1], ["tl", "tweets", C.err, 3]],
      },
      {
        title: "Fan-out on write (push)",
        body: "When Bob posts, workers look up his followers and **prepend the post id to each follower's cached timeline**. Reading a feed becomes one cache read. Most users have < 1,000 followers, so writes stay manageable.",
        flows: [["u", "gw", C.write, 1], ["gw", "post", C.write, 1], ["post", "tweets", C.write, 1], ["post", "q", C.async, 1], ["q", "fan", C.async, 1], ["fan", "graph", C.read, 0.8], ["fan", "tc", C.write, 2]],
      },
      {
        title: "Reads are now one lookup",
        body: "`GET /feed` reads ~800 post ids from the timeline cache and hydrates them from the post store (batched, cached). p99 well under 200 ms.",
        badges: { tc: "LRANGE 0..50" },
        flows: [["u", "gw", C.req, 3], ["gw", "tl", C.req, 3], ["tl", "tc", C.ok, 2.5], ["tl", "tweets", C.read, 1]],
      },
      {
        title: "The celebrity problem",
        body: "A post by an account with 100M followers would mean 100M cache writes. **Hybrid**: skip fan-out for celebrities; at read time, merge their recent posts (pulled, heavily cached) into the precomputed timeline.",
        hot: ["fan", "tc"],
        badges: { post: "@star · 100M", tl: "merge pull + push" },
        flows: [["post", "q", C.async, 2], ["q", "fan", C.err, 2], ["fan", "tc", C.err, 3], ["tl", "tweets", C.read, 1.5], ["tl", "tc", C.ok, 1.5]],
      },
    ],
    sections: [
      {
        title: "Data model",
        body: `- **Posts**: \`post_id (Snowflake, time-sortable), author_id, body, media_refs, created_at\` sharded by \`post_id\`.
- **Social graph**: \`follows(follower_id, followee_id)\` with both directions indexed (sharded by user).
- **Timeline cache**: Redis list per user, capped (~800 ids). Rebuild on demand for inactive users.`,
      },
      {
        title: "Deep dives",
        body: `- **Ranking**: candidate generation (followed + recommended) → feature fetch → ML scoring → re-ranking for diversity.
- **Pagination**: cursor = last seen post id; never OFFSET.
- **Media**: upload to object storage via pre-signed URLs; serve via CDN.
- **Inactive users**: don't fan out to users who haven't logged in for 30 days; build lazily.
- **Deletes / edits**: tombstones resolved at hydration time.`,
      },
    ],
    keyNumbers: [
      { label: "Posts", value: "~600M/day ≈ 7k/s" },
      { label: "Feed reads", value: "~300k/s peak" },
      { label: "Timeline inserts (push)", value: "~1M+/s" },
    ],
    tradeoffs: [
      { option: "Push (on write)", pros: ["Fast reads", "Simple read path"], cons: ["Write amplification", "Wasted work for inactive users", "Celebrity storms"] },
      { option: "Pull (on read)", pros: ["Cheap writes", "Always fresh"], cons: ["Slow, expensive reads"] },
      { option: "Hybrid", pros: ["Best of both"], cons: ["Two code paths", "Merge complexity"] },
    ],
    interview: ["Do the follower-count math to justify hybrid.", "Explain timeline cache size and eviction.", "Cursor pagination."],
    lab: [{ href: "/lab?template=news-feed", label: "Load reference design" }, { href: "/practice?tab=interviews&id=news-feed", label: "Mock interview" }],
  },

  {
    slug: "chat-system",
    track: "case-studies",
    title: "Case Study: Chat System",
    subtitle: "WebSockets, connection registry, ordering, delivery receipts and offline sync.",
    level: "advanced",
    minutes: 24,
    quizTopic: "chat-system",
    scene: {
      nodes: [
        { id: "a", type: "client", label: "Alice", pos: [-7, -2.5] },
        { id: "b", type: "client", label: "Bob", pos: [-7, 2.5] },
        { id: "ws1", type: "server", label: "WS gateway 1", pos: [-3.5, -2.5] },
        { id: "ws2", type: "server", label: "WS gateway 2", pos: [-3.5, 2.5] },
        { id: "chat", type: "server", label: "Chat service", pos: [0.3, 0] },
        { id: "reg", type: "cache", label: "Presence / registry", pos: [3.8, -3] },
        { id: "store", type: "nosql", label: "Messages", pos: [3.8, 0] },
        { id: "q", type: "queue", label: "Offline / push", pos: [3.8, 3] },
        { id: "push", type: "worker", label: "APNs / FCM", pos: [7, 3] },
      ],
      edges: [["a", "ws1"], ["b", "ws2"], ["ws1", "chat"], ["ws2", "chat"], ["chat", "reg"], ["chat", "store"], ["chat", "q"], ["q", "push"]],
    },
    steps: [
      {
        title: "Persistent connections",
        body: "Each client keeps a **WebSocket** to a gateway. One gateway holds ~100k connections; 50M online users ≈ 500+ gateways. The registry records which gateway holds each user.",
        show: ["a", "b", "ws1", "ws2", "chat", "reg"],
        badges: { reg: "bob → ws2" },
        flows: [["a", "ws1", C.vote, 0.6], ["b", "ws2", C.vote, 0.6], ["ws1", "chat", C.vote, 0.4], ["chat", "reg", C.write, 0.6]],
      },
      {
        title: "Send a message",
        body: "Alice → ws1 → Chat service, which assigns a **per-conversation sequence number**, persists the message, then looks up Bob's gateway and pushes it down his socket. Alice gets a ✓ (sent) when it is stored.",
        show: ["a", "b", "ws1", "ws2", "chat", "reg", "store"],
        flows: [["a", "ws1", C.write, 1.2], ["ws1", "chat", C.write, 1.2], ["chat", "store", C.write, 1], ["chat", "reg", C.read, 0.6], ["chat", "ws2", C.ok, 1], ["ws2", "b", C.ok, 1]],
        edges: [["chat", "ws2"]],
      },
      {
        title: "Bob is offline",
        body: "No live connection: the message stays in the store and a push notification is queued. When Bob reconnects, his client sends its last seen sequence per conversation and **syncs the gap**.",
        down: ["b", "ws2"],
        flows: [["a", "ws1", C.write, 1], ["ws1", "chat", C.write, 1], ["chat", "store", C.write, 1], ["chat", "q", C.async, 1], ["q", "push", C.async, 1]],
      },
      {
        title: "Receipts and presence",
        body: "Delivered (✓✓) and read receipts are just small messages flowing back. Presence is a heartbeat-refreshed key with a TTL in the registry; friends subscribe to changes, batched to avoid storms.",
        flows: [["b", "ws2", C.ok, 0.8], ["ws2", "chat", C.ok, 0.8], ["chat", "ws1", C.ok, 0.8], ["ws1", "a", C.ok, 0.8], ["chat", "reg", C.write, 0.5]],
        edges: [["chat", "ws1"]],
      },
    ],
    sections: [
      {
        title: "Storage",
        body: `A wide-column store (Cassandra/ScyllaDB/HBase) partitioned by \`conversation_id\` and clustered by \`seq\` makes "latest 50 messages" one partition read. Very large group chats can be bucketed by time to bound partition size.`,
      },
      {
        title: "Ordering & duplicates",
        body: `Global ordering is unnecessary and expensive. Order per conversation (a counter in the chat service or the DB). Clients attach a \`client_msg_id\` so retries after a flaky network are deduplicated.`,
      },
      {
        title: "Groups",
        body: `Small groups: fan out to each member's gateway. Large groups / channels: fan out via a pub/sub layer and let clients pull. Cap group sizes or switch to the broadcast model above a threshold.`,
      },
      {
        title: "Extras",
        body: `- **E2E encryption** (Signal protocol): server stores ciphertext; search/moderation move client-side.
- **Media**: upload to object storage, send a reference.
- **Multi-device**: per-device queues and keys.`,
      },
    ],
    keyNumbers: [
      { label: "Connections per gateway", value: "~100k" },
      { label: "Messages", value: "~1M/s peak" },
      { label: "Target delivery latency", value: "< 300 ms p99" },
    ],
    interview: ["Explain how a message finds the recipient's socket.", "Per-conversation ordering + idempotent client ids.", "Offline sync by sequence numbers."],
    lab: [{ href: "/lab?template=chat-system", label: "Load reference design" }, { href: "/practice?tab=interviews&id=chat-system", label: "Mock interview" }],
  },

  {
    slug: "video-streaming",
    track: "case-studies",
    title: "Case Study: Video Platform",
    subtitle: "Upload pipelines, transcoding DAGs, adaptive bitrate and CDN-first delivery.",
    level: "advanced",
    minutes: 24,
    quizTopic: "video-streaming",
    scene: {
      nodes: [
        { id: "cr", type: "client", label: "Creators", pos: [-7, -3] },
        { id: "vw", type: "client", label: "Viewers", pos: [-7, 3] },
        { id: "api", type: "server", label: "Upload / Metadata API", pos: [-3.3, -3] },
        { id: "raw", type: "storage", label: "Raw uploads", pos: [0.3, -3] },
        { id: "q", type: "queue", label: "Transcode jobs", pos: [0.3, 0] },
        { id: "tx", type: "worker", label: "Transcoders", pos: [3.8, 0] },
        { id: "seg", type: "storage", label: "HLS segments", pos: [3.8, 3] },
        { id: "cdn", type: "cdn", label: "CDN", pos: [-3.3, 3] },
        { id: "meta", type: "db", label: "Metadata", pos: [-3.3, 0] },
      ],
      edges: [["cr", "api"], ["api", "raw"], ["api", "meta"], ["raw", "q"], ["q", "tx"], ["tx", "seg"], ["vw", "cdn"], ["cdn", "seg"]],
    },
    steps: [
      {
        title: "Upload straight to storage",
        body: "The API returns a **pre-signed URL**; the creator's client uploads (resumable, chunked) directly to object storage. Gigabytes never pass through app servers.",
        show: ["cr", "api", "raw", "meta"],
        flows: [["cr", "api", C.req, 0.6], ["api", "meta", C.write, 0.5], ["cr", "raw", C.write, 2]],
        edges: [["cr", "raw"]],
      },
      {
        title: "Transcoding pipeline",
        body: "An upload event enqueues a job. Workers split the video into chunks, encode each chunk into many renditions (240p…4K, H.264/VP9/AV1) **in parallel**, then package HLS/DASH segments and manifests.",
        show: ["cr", "api", "raw", "q", "tx", "seg", "meta"],
        badges: { tx: "6 renditions × 120 chunks" },
        flows: [["raw", "q", C.async, 1], ["q", "tx", C.async, 2], ["tx", "seg", C.write, 2]],
      },
      {
        title: "Adaptive bitrate playback",
        body: "The player fetches a manifest, then 2–6 s segments from the CDN, switching rendition per segment based on measured bandwidth. Popular videos are >99% edge hits.",
        badges: { cdn: "hit 98%" },
        flows: [["vw", "cdn", C.ok, 3], ["cdn", "seg", C.read, 0.3]],
      },
    ],
    sections: [
      {
        title: "Capacity",
        body: `5M concurrent viewers × 5 Mbps = **25 Tbps** egress. That is only feasible with CDNs and ISP-embedded caches (Netflix Open Connect). Long-tail videos are served from regional caches or origin; hot videos are pre-positioned.`,
      },
      {
        title: "Metadata & discovery",
        body: `Titles, channels, view counts, comments live in sharded SQL/NoSQL with caches. Search uses an inverted index. View counts are aggregated via streaming (Kafka → Flink) and written periodically, not one DB write per view.`,
      },
      {
        title: "Cost levers",
        body: `- Encode popular videos with expensive, efficient codecs (AV1); keep cheap encodes for the long tail.
- Storage tiers: hot (SSD/CDN) → warm → cold archive.
- Per-title encoding ladders tuned to content complexity.`,
      },
    ],
    keyNumbers: [
      { label: "Egress (5M viewers @1080p)", value: "~25 Tbps" },
      { label: "Segment length", value: "2–6 s" },
      { label: "Upload volume", value: "~500 h/min" },
    ],
    interview: ["Keep video bytes off app servers.", "Transcoding as a parallel DAG.", "Do the egress math → CDN."],
    lab: [{ href: "/lab?template=video-streaming", label: "Load reference design" }, { href: "/practice?tab=interviews&id=video-streaming", label: "Mock interview" }],
  },

  {
    slug: "ride-sharing",
    track: "case-studies",
    title: "Case Study: Ride Sharing",
    subtitle: "Geo-indexing hundreds of thousands of moving points and matching in seconds.",
    level: "expert",
    minutes: 26,
    quizTopic: "ride-sharing",
    scene: {
      nodes: [
        { id: "dr", type: "client", label: "Drivers", pos: [-7, -3] },
        { id: "rd", type: "client", label: "Riders", pos: [-7, 3] },
        { id: "gw", type: "gateway", label: "Gateway", pos: [-3.8, 0] },
        { id: "loc", type: "server", label: "Location service", pos: [-0.5, -3] },
        { id: "geo", type: "cache", label: "Geo index (H3 cells)", pos: [3, -3] },
        { id: "match", type: "server", label: "Matching", pos: [-0.5, 3] },
        { id: "trips", type: "db", label: "Trips", pos: [3, 3] },
        { id: "q", type: "queue", label: "Trip events", pos: [3, 0] },
        { id: "pay", type: "worker", label: "Pricing / payments", pos: [6.5, 0] },
      ],
      edges: [["dr", "gw"], ["rd", "gw"], ["gw", "loc"], ["gw", "match"], ["loc", "geo"], ["match", "geo"], ["match", "trips"], ["match", "q"], ["q", "pay"]],
    },
    steps: [
      {
        title: "Location firehose",
        body: "1M active drivers send GPS every 4 s ≈ **250k updates/s**. The location service writes the latest position into an **in-memory geo index**: each point mapped to an H3/geohash cell. History goes to a stream, not a database row per update.",
        show: ["dr", "gw", "loc", "geo"],
        badges: { geo: "250k w/s" },
        flows: [["dr", "gw", C.write, 3], ["gw", "loc", C.write, 3], ["loc", "geo", C.write, 3]],
      },
      {
        title: "Find nearby drivers",
        body: "A ride request looks up the rider's cell and its neighbours (k-ring), returning candidate drivers in milliseconds. The index is sharded by region/cell; dense cities get more shards.",
        show: ["rd", "gw", "match", "geo", "dr", "loc"],
        flows: [["rd", "gw", C.req, 1], ["gw", "match", C.req, 1], ["match", "geo", C.read, 1.5], ["dr", "gw", C.write, 1.5], ["gw", "loc", C.write, 1.5], ["loc", "geo", C.write, 1.5]],
      },
      {
        title: "Match and commit the trip",
        body: "Rank candidates by ETA, offer to one driver with a timeout, and on accept write the trip with a **state machine** (requested → accepted → arrived → in_progress → completed) using conditional updates so double-accepts are impossible.",
        focus: ["trips"],
        flows: [["match", "trips", C.write, 1.2], ["match", "geo", C.read, 0.8], ["match", "q", C.async, 1]],
      },
      {
        title: "Async pricing and payments",
        body: "Trip events feed surge pricing (supply/demand per cell, computed on a stream) and the payment workflow: an idempotent saga that authorises, captures and pays out.",
        flows: [["match", "q", C.async, 1], ["q", "pay", C.async, 1.5]],
      },
    ],
    sections: [
      {
        title: "Geo indexing",
        body: `- **Geohash**: base32 strings; prefix = area. Simple, edge effects at cell borders (query neighbours).
- **H3** (Uber): hexagonal cells with uniform neighbour distances, great for surge and supply analytics.
- **Quadtree**: adaptive cell size by density, in-memory.
Updating a moving point = remove from old cell, add to new cell.`,
      },
      {
        title: "Separate hot paths",
        body: `Location updates are **high volume, low value, ephemeral**. Trips and payments are **low volume, high value, durable**. Give them different stores, scaling strategies and consistency levels.`,
      },
      {
        title: "Reliability",
        body: `- Regional cells: a city's traffic stays in one region; failover drains to a neighbour.
- Drivers' apps buffer updates during connectivity loss.
- Idempotency keys on every payment step; reconcile with the provider daily.`,
      },
    ],
    keyNumbers: [
      { label: "Location updates", value: "~250k/s" },
      { label: "Ride requests", value: "~10k/s peak" },
      { label: "Search radius", value: "k-ring of 1–2 cells" },
    ],
    interview: ["Do the location QPS math first.", "Choose a geo index and explain neighbour lookups.", "Make trip transitions idempotent."],
    lab: [{ href: "/lab?template=ride-sharing", label: "Load reference design" }, { href: "/practice?tab=interviews&id=ride-sharing", label: "Mock interview" }],
  },
];
