"""Quiz bank. Answers stay server-side; the API returns questions without them."""

Q = []


def q(topic, difficulty, prompt, options, answer, explanation):
    Q.append({"id": f"{topic}-{sum(1 for x in Q if x['topic'] == topic) + 1}", "topic": topic,
              "difficulty": difficulty, "prompt": prompt, "options": options, "answer": answer,
              "explanation": explanation})


# --- scalability basics
q("scalability-basics", "easy", "Which statement best describes horizontal scaling?",
  ["Buying a bigger machine", "Adding more machines and spreading work across them",
   "Adding more indexes to the database", "Compressing responses"], 1,
  "Horizontal scaling (scale-out) adds nodes. It needs stateless services or partitioned state, but has no hard ceiling.")
q("scalability-basics", "medium", "Roughly how long is a round trip within the same datacenter?",
  ["~0.5 ms", "~50 ms", "~5 ms", "~500 µs per KB"], 0,
  "Intra-DC round trips are ~0.5 ms; cross-continent round trips are ~150 ms. This gap is why chatty cross-region calls hurt.")
q("scalability-basics", "medium", "A service has p50 = 20 ms and p99 = 900 ms. A page fans out to 50 such calls in parallel. What dominates page latency?",
  ["The p50", "The p99 (tail latency)", "The mean", "DNS"], 1,
  "With 50 parallel calls, the chance at least one hits the p99 is 1 - 0.99^50 ≈ 39%. Fan-out amplifies the tail.")
q("scalability-basics", "hard", "Why should application servers be stateless to scale horizontally?",
  ["Stateless code runs faster", "Any instance can serve any request, so instances can be added, removed or replaced freely",
   "It removes the need for a database", "Stateless servers do not need load balancers"], 1,
  "Session or user state pinned to one box blocks rebalancing and failover. Push state to shared stores (cache, DB) or the client (tokens).")

# --- load balancing
q("load-balancing", "easy", "What does an L4 load balancer route on?",
  ["HTTP path and headers", "IP address and TCP/UDP port", "Cookie contents", "Request body"], 1,
  "L4 works on connections (IP/port). L7 terminates HTTP and can route by path, header, cookie, and do retries.")
q("load-balancing", "medium", "Servers have very different request costs (some requests take 10x longer). Which algorithm adapts best?",
  ["Round robin", "Random", "Least connections / least outstanding requests", "IP hash"], 2,
  "Least-connections sends work to whichever backend has the fewest in-flight requests, naturally avoiding slow, busy nodes.")
q("load-balancing", "medium", "What is the main purpose of active health checks?",
  ["Encrypt traffic", "Remove failing backends from rotation before users hit them", "Compress payloads", "Pin sessions"], 1,
  "The LB probes /health and ejects unhealthy instances. Passive checks (observed errors) complement them.")
q("load-balancing", "hard", "'Power of two choices' load balancing means...",
  ["Two LBs in active-passive", "Pick 2 random backends, send to the less loaded one",
   "Retry every request twice", "Split traffic 50/50 between two regions"], 1,
  "Sampling two and choosing the better gives exponentially better max-load than pure random, without global state.")
q("load-balancing", "medium", "Sticky sessions are usually a smell because...",
  ["They are slower", "They break even load spread and make instance loss drop user sessions",
   "They require UDP", "They disable TLS"], 1,
  "Stickiness ties users to an instance. Externalize session state so any backend can serve any user.")

# --- caching
q("caching", "easy", "In cache-aside (lazy loading), who populates the cache on a miss?",
  ["The database", "The application", "The CDN", "The load balancer"], 1,
  "App reads cache; on miss it reads the DB, then writes the value into the cache with a TTL.")
q("caching", "medium", "A popular key expires and 10,000 requests hit the DB at once. This is called...",
  ["Cache penetration", "Thundering herd / cache stampede", "Write-back", "Cache warming"], 1,
  "Mitigations: request coalescing (single-flight), locks, probabilistic early expiration, stale-while-revalidate.")
q("caching", "medium", "Which write strategy risks data loss if the cache node crashes?",
  ["Write-through", "Write-around", "Write-back (write-behind)", "Cache-aside"], 2,
  "Write-back acknowledges after writing to cache and flushes to the DB later; unflushed writes are lost on crash.")
q("caching", "hard", "Requests for keys that do not exist in the DB keep missing the cache. A cheap defence is...",
  ["Bigger TTLs", "Cache negative results briefly or use a Bloom filter", "More DB replicas", "LFU eviction"], 1,
  "This is cache penetration. Cache 'not found' with a short TTL or check a Bloom filter of existing keys first.")
q("caching", "medium", "A batch job scans millions of keys once. Which eviction policy suffers most?",
  ["LRU", "LFU", "TinyLFU", "Optimal"], 0,
  "LRU admits every scanned key and evicts the hot set. Frequency-aware admission (TinyLFU) resists scans.")

# --- cdn
q("cdn", "easy", "What does a CDN primarily reduce?",
  ["Database writes", "Distance (latency) to users and load on the origin", "CPU usage of clients", "DNS TTLs"], 1,
  "Edge PoPs cache content near users, cutting RTT and absorbing traffic before it reaches the origin.")
q("cdn", "medium", "Best way to deploy a new version of app.js cached for a year at the edge?",
  ["Purge all edges every deploy", "Use content-hashed file names (app.3f9a.js)", "Set TTL to 0", "Use cookies"], 1,
  "Immutable, fingerprinted URLs let you cache forever; new deploys reference new URLs. No purge race.")
q("cdn", "hard", "An origin shield is...",
  ["A WAF rule", "A mid-tier cache that all edges fetch through, collapsing misses before the origin",
   "A DDoS scrubbing center", "A TLS certificate"], 1,
  "Without a shield, N edges missing at once send N origin requests. The shield turns those into one.")
q("cdn", "medium", "Pull CDN vs push CDN: in a pull CDN...",
  ["You upload files to the CDN ahead of time", "Edges fetch from the origin on first request then cache",
   "Clients push content", "Only video is supported"], 1,
  "Pull is simplest; push suits large, predictable assets (e.g. pre-positioned video).")

# --- replication
q("replication", "easy", "Read replicas help mainly with...",
  ["Write throughput", "Read throughput and availability", "Schema migrations", "Storage size"], 1,
  "Replicas serve reads and can be promoted on primary failure. Writes still go to one primary.")
q("replication", "medium", "A user updates their profile and immediately reloads, seeing old data. Which guarantee was violated?",
  ["Monotonic reads", "Read-your-writes", "Linearizability of other users", "Durability"], 1,
  "Async replica lag. Fix: read from the primary for a short window after a write, or route by the user's write timestamp.")
q("replication", "hard", "Semi-synchronous replication means...",
  ["No replica ever acknowledges", "The primary waits for at least one replica before ACKing",
   "Every replica must ACK", "Replicas write before the primary"], 1,
  "It bounds data loss on failover to zero committed transactions on at least one replica, at a latency cost.")
q("replication", "hard", "In multi-leader replication, the hardest problem is...",
  ["Read scaling", "Write conflicts between leaders", "Backups", "Index creation"], 1,
  "Concurrent writes to the same row in two leaders must be resolved (LWW, CRDTs, app-level merge).")

# --- sharding
q("sharding", "easy", "Sharding (horizontal partitioning) splits...",
  ["Columns into tables", "Rows across multiple database nodes by a shard key", "Indexes across disks", "Logs by date"], 1,
  "Each shard holds a subset of rows, so writes and storage scale with shard count.")
q("sharding", "medium", "Range sharding on an auto-increment id causes...",
  ["Perfect balance", "A hot shard receiving all new writes", "Scatter-gather on every query", "Data loss"], 1,
  "Monotonic keys always land in the last range. Hash the key or prefix it.")
q("sharding", "medium", "The main cost of hash-based sharding is...",
  ["Hot shards", "Range queries must hit every shard (scatter-gather)", "No replication", "Large keys"], 1,
  "Adjacent keys land on different shards, so ORDER BY / BETWEEN queries fan out.")
q("sharding", "hard", "A celebrity account receives 30% of all traffic. Good mitigations include...",
  ["Range sharding", "Splitting the hot key (salting) plus caching its reads", "More vnodes", "Reducing TTLs"], 1,
  "A single key cannot be spread by placement alone. Fan its writes over sub-keys and cache or replicate its reads.")

# --- consistent hashing
q("consistent-hashing", "easy", "With modulo hashing (hash % N), adding one server to 10 moves about...",
  ["~9% of keys", "~50% of keys", "~91% of keys", "0 keys"], 2,
  "Almost every key's modulus changes. Consistent hashing moves only ~1/(N+1) ≈ 9%.")
q("consistent-hashing", "medium", "Why use virtual nodes?",
  ["Encrypt keys", "Smooth out load imbalance and spread a failed node's keys across many peers",
   "Reduce memory", "Avoid hashing"], 1,
  "Each physical node owns many small arcs; distribution evens out and recovery load is shared.")
q("consistent-hashing", "medium", "A key belongs to...",
  ["The node with the smallest hash", "The first node clockwise from the key's hash", "A random node", "All nodes"], 1,
  "Walk clockwise around the ring from hash(key) to the first node token.")
q("consistent-hashing", "hard", "Rendezvous (HRW) hashing differs from ring hashing because it...",
  ["Needs no ring: each key picks the node with the highest hash(key, node)", "Uses modulo", "Cannot remove nodes", "Requires ZooKeeper"], 0,
  "HRW gives the same minimal-disruption property with O(N) lookup and no token management.")

# --- CAP & consistency
q("cap-consistency", "easy", "During a network partition, CAP says you must choose between...",
  ["Latency and throughput", "Consistency and availability", "SQL and NoSQL", "Cost and durability"], 1,
  "If nodes cannot talk, either reject some requests (C) or serve possibly stale data (A).")
q("cap-consistency", "medium", "PACELC adds that, Else (no partition), you trade...",
  ["Latency vs consistency", "Cost vs size", "Durability vs memory", "Throughput vs CPU"], 0,
  "Even without partitions, stronger consistency costs coordination latency.")
q("cap-consistency", "medium", "With N=3 replicas, which R/W setting guarantees reads see the latest acknowledged write?",
  ["R=1, W=1", "R=1, W=2", "R=2, W=2", "R=1, W=1 with retries"], 2,
  "R + W > N (2+2 > 3) makes read and write quorums overlap.")
q("cap-consistency", "hard", "Linearizability is stronger than sequential consistency because it also...",
  ["Is eventual", "Respects real-time order of non-overlapping operations", "Allows stale reads", "Needs no clocks"], 1,
  "Once a write completes, every later read (in wall-clock time) must see it.")

# --- consensus
q("consensus", "easy", "In Raft, how many nodes must vote for a candidate to become leader in a 5-node cluster?",
  ["2", "3", "4", "5"], 1, "A majority: floor(5/2)+1 = 3. Majorities always intersect, preventing two leaders in one term.")
q("consensus", "medium", "Why are Raft election timeouts randomized (e.g. 150-300 ms)?",
  ["Save CPU", "Avoid split votes where many nodes become candidates at once", "Encrypt votes", "Sync clocks"], 1,
  "Randomization makes it likely one node times out first and wins before others start.")
q("consensus", "medium", "A 5-node cluster can tolerate how many failed nodes?",
  ["1", "2", "3", "4"], 1, "Needs a majority (3) alive: 5 - 3 = 2 failures. 2f+1 nodes tolerate f failures.")
q("consensus", "hard", "A leader isolated in a minority partition keeps accepting writes. What happens to them?",
  ["They commit", "They never commit and are overwritten when the partition heals", "They are merged", "They become a new cluster"], 1,
  "It cannot reach a majority, so entries stay uncommitted; the new majority leader's log wins.")
q("consensus", "hard", "Raft only commits entries from the leader's current term by counting replicas because...",
  ["It is faster", "An older-term entry on a majority can still be overwritten (Figure 8 scenario)", "Terms reset", "Of disk ordering"], 1,
  "Committing the current-term entry implicitly commits all earlier ones safely.")

# --- queues
q("queues", "easy", "A main benefit of putting a queue between services is...",
  ["Lower storage", "Decoupling and absorbing bursts (load leveling)", "Stronger consistency", "Fewer servers needed always"], 1,
  "Producers enqueue at peak rate; consumers drain at a sustainable rate.")
q("queues", "medium", "Most brokers guarantee at-least-once delivery. Consumers must therefore be...",
  ["Stateless", "Idempotent", "Single-threaded", "Synchronous"], 1,
  "Redeliveries happen after timeouts or crashes. Dedupe with idempotency keys or upserts.")
q("queues", "medium", "In Kafka, ordering is guaranteed...",
  ["Across the whole topic", "Within a partition", "Never", "Per consumer group across partitions"], 1,
  "Use a key (e.g. order_id) so related events land in the same partition.")
q("queues", "medium", "A message that fails processing repeatedly should go to...",
  ["/dev/null", "A dead-letter queue for inspection and replay", "The front of the queue", "The database"], 1,
  "DLQs stop poison messages from blocking the stream.")
q("queues", "hard", "The transactional outbox pattern solves...",
  ["Slow consumers", "Atomically updating the DB and publishing an event (dual-write problem)", "Message size limits", "Ordering"], 1,
  "Write the event to an outbox table in the same transaction; a relay publishes it.")

# --- rate limiting
q("rate-limiting", "easy", "Which algorithm allows short bursts up to a bucket size while enforcing an average rate?",
  ["Fixed window", "Token bucket", "Sliding log", "Round robin"], 1, "Tokens accumulate up to capacity; bursts spend them.")
q("rate-limiting", "medium", "Fixed-window limiting can admit up to 2x the limit because...",
  ["Of clock skew", "A burst at the end of one window and the start of the next both pass", "Counters overflow", "Of retries"], 1,
  "Sliding window log/counter smooth this boundary effect.")
q("rate-limiting", "medium", "Which HTTP status signals rate limiting?", ["403", "429", "503", "418"], 1,
  "429 Too Many Requests, ideally with Retry-After and X-RateLimit-* headers.")
q("rate-limiting", "hard", "In a distributed rate limiter backed by Redis, why use a Lua script or INCR+EXPIRE atomically?",
  ["Speed only", "Avoid race conditions between read and update across many gateways", "Persistence", "Compression"], 1,
  "Check-then-set from multiple nodes races. Atomic server-side operations keep counts correct.")

# --- microservices
q("microservices", "easy", "What does an API gateway typically handle?",
  ["Disk I/O", "Routing, auth, rate limiting, TLS termination for many services", "Database replication", "Garbage collection"], 1,
  "It is the single entry point applying cross-cutting concerns.")
q("microservices", "medium", "A circuit breaker in the OPEN state...",
  ["Sends all traffic", "Fails fast without calling the unhealthy dependency", "Retries forever", "Restarts the service"], 1,
  "After a cool-down it goes HALF-OPEN and lets trial requests probe recovery.")
q("microservices", "medium", "Retries without backoff and jitter can cause...",
  ["Lower latency", "Retry storms that keep a recovering service down", "Better caching", "Fewer errors"], 1,
  "Use exponential backoff with jitter, retry budgets, and only retry idempotent operations.")
q("microservices", "hard", "A saga coordinates a multi-service transaction by...",
  ["Two-phase commit", "A sequence of local transactions with compensating actions on failure", "A global lock", "Event sourcing only"], 1,
  "Each step commits locally; failures trigger compensations (refund, release seat...).")

# --- observability & reliability
q("observability", "easy", "The three pillars of observability are...",
  ["CPU, RAM, disk", "Metrics, logs, traces", "SLA, SLO, SLI", "Alerts, pages, tickets"], 1,
  "Metrics show what, logs show detail, traces show where across services.")
q("observability", "medium", "An SLO of 99.9% monthly availability allows roughly how much downtime?",
  ["~4.3 min", "~43 min", "~7.2 h", "~3.6 days"], 1, "0.1% of 30 days ≈ 43.2 minutes. 99.99% ≈ 4.3 min.")
q("observability", "medium", "Two independent services each 99.9% available, called in series. Combined availability?",
  ["99.9%", "~99.8%", "99.99%", "~99.0%"], 1, "0.999 × 0.999 ≈ 0.998. Serial dependencies multiply; redundancy adds nines.")
q("observability", "hard", "Why alert on SLO burn rate rather than raw error count?",
  ["Fewer dashboards", "It pages only when the error budget is being consumed fast enough to matter", "It is cheaper", "Logs are unreliable"], 1,
  "Multi-window burn-rate alerts catch fast outages and slow leaks with low noise.")

# --- case studies
q("url-shortener", "medium", "Best way to generate short codes at high write rates without collisions?",
  ["Random 3-char strings", "Base62-encode IDs from a distributed ID generator / pre-allocated ranges",
   "MD5 the URL and keep 2 chars", "Use timestamps"], 1,
  "Range allocation (or Snowflake IDs) + base62 gives unique, compact codes; 7 chars of base62 ≈ 3.5 trillion.")
q("url-shortener", "medium", "Redirects should use which status when you need click analytics?",
  ["301 (cached by browsers)", "302/307 (not permanently cached)", "200", "404"], 1,
  "301 lets browsers skip your server next time, so you lose click counts.")
q("news-feed", "hard", "Fan-out-on-write for a user with 50M followers is problematic because...",
  ["Reads become slow", "One post triggers 50M timeline writes", "Celebrities post rarely", "Caches are small"], 1,
  "Hybrid: push for normal users, pull celebrity posts at read time and merge.")
q("chat-system", "medium", "Which transport fits real-time bidirectional chat best?",
  ["HTTP polling every 5s", "WebSockets", "SMTP", "FTP"], 1, "Long-lived WebSocket connections push messages instantly with low overhead.")
q("video-streaming", "medium", "Adaptive bitrate streaming (HLS/DASH) works by...",
  ["Sending one big MP4", "Splitting video into small segments at several bitrates; the player switches per segment",
   "UDP multicast", "Peer-to-peer only"], 1, "The client measures bandwidth and picks the best rendition for each few-second chunk.")
q("ride-sharing", "hard", "To find nearby drivers fast, the location service typically indexes positions with...",
  ["A B-tree on latitude", "Geohash / H3 cells or a quadtree held in memory", "Full table scans", "DNS"], 1,
  "Cells turn a 2D radius search into a lookup of a few neighbouring cells, updated every few seconds.")

QUESTIONS = {x["id"]: x for x in Q}
TOPICS = sorted({x["topic"] for x in Q})
