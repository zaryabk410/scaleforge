import { C, type Lesson } from "./types";

export const data: Lesson[] = [
  {
    slug: "replication",
    track: "data",
    title: "Replication",
    subtitle: "Primaries, replicas, lag, failover, and the guarantees users actually notice.",
    level: "intermediate",
    minutes: 18,
    quizTopic: "replication",
    scene: {
      nodes: [
        { id: "app", type: "server", label: "App", pos: [-5, 0] },
        { id: "p", type: "db", label: "Primary", pos: [-1, 0] },
        { id: "r1", type: "db", label: "Replica 1", pos: [3, -3] },
        { id: "r2", type: "db", label: "Replica 2", pos: [3, 0] },
        { id: "r3", type: "db", label: "Replica 3 (other AZ)", pos: [3, 3] },
      ],
      edges: [["app", "p"], ["p", "r1"], ["p", "r2"], ["p", "r3"], ["app", "r1"], ["app", "r2"], ["app", "r3"]],
    },
    steps: [
      {
        title: "Single-leader replication",
        body: "All writes go to the **primary**. It appends them to its write-ahead log and streams the log to replicas, which apply the same changes in the same order.",
        flows: [["app", "p", C.write, 1.5], ["p", "r1", C.async, 1], ["p", "r2", C.async, 1], ["p", "r3", C.async, 1]],
      },
      {
        title: "Scale reads",
        body: "Replicas serve reads. A read-heavy workload (95% reads) scales almost linearly with replica count, while the primary keeps write capacity for writes.",
        badges: { r1: "reads", r2: "reads", r3: "reads" },
        flows: [["app", "p", C.write, 0.6], ["app", "r1", C.read, 1.5], ["app", "r2", C.read, 1.5], ["app", "r3", C.read, 1.5], ["p", "r1", C.async, 0.5], ["p", "r2", C.async, 0.5], ["p", "r3", C.async, 0.5]],
      },
      {
        title: "Replication lag",
        body: "Asynchronous replicas trail the primary by milliseconds to minutes. A user saves a profile, refreshes, hits Replica 3 and sees the **old** value. That breaks *read-your-writes*.",
        hot: ["r3"],
        badges: { r3: "lag 4.2 s" },
        flows: [["app", "p", C.write, 1], ["app", "r3", C.err, 1], ["p", "r3", C.async, 0.3]],
      },
      {
        title: "Primary fails → failover",
        body: "Health checks notice the primary is gone, the most up-to-date replica is **promoted**, and clients are re-pointed. With async replication, writes not yet shipped are lost; semi-sync bounds that loss.",
        down: ["p"],
        focus: ["r1"],
        badges: { r1: "NEW PRIMARY" },
        edges: [["r1", "r2"], ["r1", "r3"]],
        flows: [["app", "r1", C.write, 1.5], ["r1", "r2", C.async, 1], ["r1", "r3", C.async, 1]],
      },
    ],
    sections: [
      {
        title: "Sync, async, semi-sync",
        body: `- **Synchronous**: primary waits for replicas before ACK. No data loss, but latency = slowest replica and a dead replica blocks writes.
- **Asynchronous**: ACK immediately. Fast, but failover can lose recent writes.
- **Semi-synchronous**: wait for at least one replica. The common production compromise (MySQL semi-sync, Postgres \`synchronous_standby_names\` with ANY 1).`,
      },
      {
        title: "Consistency guarantees users notice",
        body: `- **Read-your-writes**: after I write, I see my write. Route a user's reads to the primary for N seconds after they write, or track a log position (LSN) and wait for the replica to catch up.
- **Monotonic reads**: I never see time go backwards. Pin a user to one replica.
- **Consistent prefix**: I see causally related writes in order (question before answer). Keep related writes in one partition.`,
      },
      {
        title: "Multi-leader and leaderless",
        body: `**Multi-leader**: each region accepts writes and replicates to others. Great for multi-region latency and offline clients, but concurrent writes conflict: resolve with last-write-wins (lossy), CRDTs, or app-level merges.

**Leaderless (Dynamo-style)**: write to W of N replicas, read from R. If R + W > N, quorums overlap. Read repair and anti-entropy (Merkle trees) heal divergence. Used by Cassandra, DynamoDB, Riak. Explore in the **Quorum lab**.`,
      },
      {
        title: "Failover hazards",
        body: `- **Split brain**: two nodes both think they are primary. Use fencing tokens / STONITH and a consensus system (etcd, ZooKeeper) to elect.
- **Lost writes** with async replication.
- **Timeouts**: too short ⇒ needless failovers under load spikes; too long ⇒ longer outages.`,
      },
    ],
    keyNumbers: [
      { label: "Typical async lag (same region)", value: "< 100 ms" },
      { label: "Automated failover", value: "~10–60 s" },
      { label: "Replicas for 3-AZ durability", value: "1 primary + 2 replicas" },
    ],
    tradeoffs: [
      { option: "Single leader", pros: ["Simple", "No write conflicts", "Strong consistency on primary"], cons: ["Write throughput bounded by one node", "Failover complexity"] },
      { option: "Multi-leader", pros: ["Low-latency writes in every region", "Survives region loss"], cons: ["Conflict resolution", "Hard to reason about"] },
      { option: "Leaderless", pros: ["No failover", "Tunable consistency", "High availability"], cons: ["Eventual consistency by default", "Read repair overhead"] },
    ],
    pitfalls: ["Reading from replicas right after writes", "Assuming failover is free of data loss", "No fencing → split brain"],
    interview: ["Say which reads can tolerate staleness.", "Describe failover and what is lost.", "Mention cross-AZ replicas for durability."],
    lab: [{ href: "/lab/algorithms?tab=quorum", label: "Quorum (N/R/W) lab" }, { href: "/lab?challenge=no-spof", label: "Challenge: Kill Anything" }],
  },

  {
    slug: "sharding",
    track: "data",
    title: "Sharding",
    subtitle: "Splitting data across machines: shard keys, hot spots, resharding and cross-shard queries.",
    level: "advanced",
    minutes: 20,
    quizTopic: "sharding",
    scene: {
      nodes: [
        { id: "app", type: "server", label: "App", pos: [-5.5, 0] },
        { id: "router", type: "gateway", label: "Shard router", pos: [-2, 0] },
        { id: "s1", type: "db", label: "Shard 1 · A–F", pos: [2, -4.2] },
        { id: "s2", type: "db", label: "Shard 2 · G–M", pos: [2, -1.4] },
        { id: "s3", type: "db", label: "Shard 3 · N–S", pos: [2, 1.4] },
        { id: "s4", type: "db", label: "Shard 4 · T–Z", pos: [2, 4.2] },
      ],
      edges: [["app", "router"], ["router", "s1"], ["router", "s2"], ["router", "s3"], ["router", "s4"]],
    },
    steps: [
      {
        title: "One primary is not enough",
        body: "Replication scales reads, but every write still lands on one primary, and one disk holds all the data. At ~10k writes/s or tens of TB you need to **partition** the data itself.",
        show: ["app", "s2"],
        edges: [["app", "s2"]],
        hot: ["s2"],
        badges: { s2: "40 TB · 9k w/s" },
        flows: [["app", "s2", C.write, 3]],
      },
      {
        title: "Split by a shard key",
        body: "Each row belongs to exactly one shard, chosen from its **shard key** (e.g. `user_id`). The router (or a client library) maps key → shard. Each shard has its own replicas.",
        flows: [["app", "router", C.req, 2.5], ["router", "s1", C.write, 0.8], ["router", "s2", C.write, 0.8], ["router", "s3", C.write, 0.8], ["router", "s4", C.write, 0.8]],
      },
      {
        title: "Range sharding & hot spots",
        body: "Range sharding keeps adjacent keys together (cheap range scans), but a monotonic key like `created_at` or an auto-increment id sends **every new write to the last shard**.",
        hot: ["s4"],
        badges: { s4: "all new writes" },
        flows: [["app", "router", C.req, 2.5], ["router", "s4", C.err, 2.5], ["router", "s1", C.read, 0.2]],
      },
      {
        title: "Hash sharding spreads load",
        body: "`shard = hash(user_id) mod N` spreads keys evenly. The price: range queries (`WHERE created_at BETWEEN…`) must ask every shard and merge (scatter-gather).",
        badges: { s1: "25%", s2: "25%", s3: "25%", s4: "25%" },
        flows: [["app", "router", C.req, 2.5], ["router", "s1", C.write, 0.8], ["router", "s2", C.write, 0.8], ["router", "s3", C.write, 0.8], ["router", "s4", C.write, 0.8]],
      },
      {
        title: "Celebrity keys",
        body: "Even perfect placement cannot split **one** key. If one account gets 30% of traffic, its shard melts. Split the hot key (`post:123#0..15`), cache its reads, or give it dedicated capacity.",
        hot: ["s2"],
        badges: { s2: "@celebrity" },
        flows: [["app", "router", C.req, 3], ["router", "s2", C.err, 2.4], ["router", "s1", C.write, 0.3], ["router", "s3", C.write, 0.3], ["router", "s4", C.write, 0.3]],
      },
    ],
    sections: [
      {
        title: "Choosing a shard key",
        body: `A good shard key has **high cardinality**, **even access**, and matches your **dominant query** so most requests hit one shard.

- Multi-tenant SaaS: \`tenant_id\` (all of a customer's data together; big tenants may need their own shard).
- Social: \`user_id\` for profiles and timelines; \`conversation_id\` for messages.
- Time series: \`(device_id, time bucket)\`, never just time.
- Orders: \`customer_id\` if customers read their history; \`order_id\` if lookups are by order.`,
      },
      {
        title: "Strategies",
        body: `- **Range**: ordered, cheap scans, prone to hot spots. (Bigtable, HBase, CockroachDB split ranges automatically.)
- **Hash**: even spread, scatter-gather for ranges.
- **Consistent hashing**: hash + minimal movement on resize (Cassandra, DynamoDB).
- **Directory / lookup service**: explicit key → shard table. Most flexible (move a single tenant), but the directory must be fast and highly available.
- **Geo**: by region for data residency and latency.`,
      },
      {
        title: "Resharding",
        body: `Plan for growth from day one:
- Pre-split into many **logical shards** (e.g. 1024) mapped onto few physical nodes; move logical shards later.
- Online migration: dual-write → backfill → verify → cut reads → stop old writes.
- Consistent hashing limits data movement to ~1/N when adding a node.`,
      },
      {
        title: "What gets harder",
        body: `- **Cross-shard joins** → denormalise, or join in the application.
- **Cross-shard transactions** → avoid; use sagas, or 2PC sparingly (Spanner/CockroachDB do it with consensus).
- **Global secondary indexes** → a separate index table sharded by the indexed column, updated asynchronously.
- **Unique IDs** → Snowflake-style IDs instead of auto-increment.`,
      },
    ],
    keyNumbers: [
      { label: "Comfortable writes per Postgres primary", value: "~5–20k simple writes/s" },
      { label: "Comfortable data per shard", value: "1–5 TB" },
      { label: "Logical shards (pre-split)", value: "256–4096" },
    ],
    tradeoffs: [
      { option: "Range", pros: ["Efficient range scans", "Easy splits"], cons: ["Hot spots on monotonic keys"] },
      { option: "Hash", pros: ["Even distribution"], cons: ["Scatter-gather range queries", "Resharding moves data"] },
      { option: "Directory", pros: ["Move any key anywhere", "Tenant isolation"], cons: ["Extra lookup hop", "Directory is critical infra"] },
    ],
    pitfalls: ["Sharding too early (vertical scale + replicas go far)", "Auto-increment ids as shard keys", "Ignoring cross-shard query patterns", "No resharding plan"],
    interview: ["Justify the shard key from access patterns.", "Call out hot keys and your mitigation.", "Explain how you would add shards without downtime."],
    lab: [{ href: "/lab/algorithms?tab=sharding", label: "Sharding strategy lab" }, { href: "/lab?challenge=sharded-ledger", label: "Challenge: Sharded Ledger" }],
  },

  {
    slug: "consistent-hashing",
    track: "data",
    title: "Consistent Hashing",
    subtitle: "Why hash mod N breaks on resize, and how a ring with virtual nodes fixes it.",
    level: "intermediate",
    minutes: 12,
    quizTopic: "consistent-hashing",
    scene: {
      nodes: [
        { id: "a", type: "cache", label: "Node A", pos: [0, -4] },
        { id: "b", type: "cache", label: "Node B", pos: [4, 0] },
        { id: "c", type: "cache", label: "Node C", pos: [0, 4] },
        { id: "d", type: "cache", label: "Node D", pos: [-4, 0] },
        { id: "e", type: "cache", label: "Node E (new)", pos: [3, -3] },
        { id: "app", type: "server", label: "Client", pos: [0, 0] },
      ],
      edges: [["a", "e"], ["e", "b"], ["b", "c"], ["c", "d"], ["d", "a"], ["app", "a"], ["app", "b"], ["app", "c"], ["app", "d"], ["app", "e"]],
    },
    steps: [
      {
        title: "hash(key) mod N",
        body: "With 4 cache nodes, `node = hash(key) % 4` works fine… until you add a fifth. Now `% 5` changes the answer for **~80% of keys**: a near-total cache flush and a stampede on the database.",
        show: ["a", "b", "c", "d", "app"],
        flows: [["app", "a", C.req, 1], ["app", "b", C.req, 1], ["app", "c", C.req, 1], ["app", "d", C.req, 1]],
      },
      {
        title: "Put nodes on a ring",
        body: "Hash node ids onto a circle of 2³² positions. Hash each key onto the same circle and walk **clockwise** to the first node. That node owns the key.",
        show: ["a", "b", "c", "d", "app"],
        flows: [["a", "b", C.vote, 0.6], ["b", "c", C.vote, 0.6], ["c", "d", C.vote, 0.6], ["d", "a", C.vote, 0.6]],
        edges: [["a", "b"]],
      },
      {
        title: "Adding a node moves ~1/N keys",
        body: "Node E lands between A and B. Only keys on that arc move from B to E. Everything else stays put, so ~20% of keys move instead of ~80%.",
        focus: ["e"],
        badges: { e: "+ keys from B" },
        flows: [["b", "e", C.async, 1.5], ["app", "e", C.req, 1]],
      },
      {
        title: "Virtual nodes even it out",
        body: "With few nodes the arcs are uneven: one node may own 40% of the ring. Give each physical node 100–200 **virtual nodes** at different positions; load evens out and a failed node's keys spread over all peers instead of one neighbour.",
        down: ["c"],
        badges: { a: "+5%", b: "+5%", d: "+5%", e: "+5%" },
        flows: [["app", "a", C.req, 1.2], ["app", "b", C.req, 1.2], ["app", "d", C.req, 1.2], ["app", "e", C.req, 1.2]],
      },
    ],
    sections: [
      {
        title: "Where it is used",
        body: `- Distributed caches (Memcached clients, Redis Cluster uses fixed 16,384 hash slots, a close cousin).
- Partitioned databases: Cassandra, DynamoDB, Riak.
- Load balancers wanting key affinity: Envoy ring hash and Maglev.
- CDNs choosing which cache server in a PoP holds an object.`,
      },
      {
        title: "Variants",
        body: `- **Ring with vnodes**: classic Dynamo design.
- **Rendezvous / HRW hashing**: for each key, pick the node with the highest \`hash(key, node)\`. No ring, minimal disruption, O(N) per lookup.
- **Jump consistent hash**: tiny, fast, perfectly balanced, but nodes must be numbered sequentially (good for shards, not arbitrary membership).
- **Bounded-load consistent hashing**: cap each node at (1+ε)× average to stop hot spots (used by Vimeo, Google).`,
      },
      {
        title: "Replication on the ring",
        body: `Store each key on the next R distinct physical nodes clockwise (its *preference list*). Reads and writes use quorums across them. When a node is down, a sloppy quorum writes to the next healthy node with a *hinted handoff*.`,
      },
    ],
    keyNumbers: [
      { label: "Keys moved adding 1 node to N", value: "≈ 1/(N+1)" },
      { label: "Typical vnodes per node", value: "100–256" },
      { label: "Redis Cluster slots", value: "16,384" },
    ],
    pitfalls: ["Too few vnodes → uneven load", "Hashing on a low-cardinality key", "Forgetting replication when a node leaves"],
    interview: ["Contrast mod-N vs ring movement numerically.", "Mention vnodes for balance and failure spread."],
    lab: [{ href: "/lab/algorithms?tab=hashing", label: "Hash ring lab" }],
  },

  {
    slug: "cap-consistency",
    track: "data",
    title: "CAP, PACELC & Consistency Models",
    subtitle: "What you give up during partitions, and the ladder from eventual to linearizable.",
    level: "advanced",
    minutes: 16,
    quizTopic: "cap-consistency",
    scene: {
      nodes: [
        { id: "u1", type: "client", label: "Client (EU)", pos: [-6, -2.5] },
        { id: "u2", type: "client", label: "Client (US)", pos: [6, -2.5] },
        { id: "n1", type: "nosql", label: "Replica EU", pos: [-2.5, 0] },
        { id: "n2", type: "nosql", label: "Replica US", pos: [2.5, 0] },
        { id: "n3", type: "nosql", label: "Replica APAC", pos: [0, 4] },
      ],
      edges: [["u1", "n1"], ["u2", "n2"], ["n1", "n2"], ["n2", "n3"], ["n3", "n1"]],
    },
    steps: [
      {
        title: "Replicas in sync",
        body: "Normally, writes replicate between regions and every client reads the same value. Consistency and availability are both achievable.",
        flows: [["u1", "n1", C.write, 1], ["n1", "n2", C.async, 1], ["n2", "n3", C.async, 1], ["n3", "n1", C.async, 1], ["u2", "n2", C.read, 1]],
      },
      {
        title: "The network partitions",
        body: "The transatlantic link fails. EU and US replicas cannot talk. A client in the US asks for a value the EU just changed. The system must choose.",
        hot: ["n1", "n2"],
        edges: [["n1", "n2"]],
        flows: [["u1", "n1", C.write, 1], ["n1", "n2", C.err, 0.6], ["u2", "n2", C.read, 1]],
      },
      {
        title: "Choose C: refuse",
        body: "**CP**: the US side cannot reach a majority, so it rejects the read/write (or returns an error) rather than risk stale data. Correct, but unavailable for those users. Banks, inventory, leader election.",
        down: ["n2"],
        flows: [["u1", "n1", C.write, 1], ["n1", "n3", C.async, 1], ["u2", "n2", C.err, 1]],
      },
      {
        title: "Choose A: answer anyway",
        body: "**AP**: the US replica answers with what it has. Always available, possibly stale; replicas reconcile after the partition heals (LWW, vector clocks, CRDTs). Shopping carts, likes, feeds.",
        badges: { n2: "stale v41", n1: "v42" },
        flows: [["u1", "n1", C.write, 1], ["u2", "n2", C.ok, 1]],
      },
    ],
    sections: [
      {
        title: "CAP precisely",
        body: `CAP says: **when a network partition happens**, a replicated system must sacrifice either linearizable consistency or availability (every non-failed node answers). Partitions are not optional in real networks, so the real choice is *C or A during a partition*. "CA" just means "not distributed".`,
      },
      {
        title: "PACELC",
        body: `**P**artition → **A** or **C**; **E**lse → **L**atency or **C**onsistency. Even on a healthy network, strong consistency costs coordination round trips.

- DynamoDB / Cassandra: PA/EL (tunable).
- Spanner: PC/EC (TrueTime makes it fast-ish).
- MongoDB (majority writes): PC/EC by default.`,
      },
      {
        title: "Consistency ladder",
        body: `- **Linearizable**: behaves like one copy; reads see the latest completed write in real time.
- **Sequential**: everyone sees the same order, not necessarily real-time.
- **Causal**: causally related ops are seen in order by everyone (reply after post).
- **Read-your-writes / monotonic reads**: per-session guarantees.
- **Eventual**: replicas converge if writes stop.

Stronger models need more coordination ⇒ more latency, less availability.`,
      },
      {
        title: "Conflict resolution",
        body: `- **Last-write-wins** (timestamps): simple, silently drops writes; clock skew matters.
- **Vector clocks / version vectors**: detect concurrency, let the app merge (Dynamo shopping cart).
- **CRDTs**: data types that merge automatically (counters, sets, text): used by Riak, Redis Enterprise, collaborative editors.`,
      },
    ],
    tradeoffs: [
      { option: "CP", pros: ["No stale reads", "Simpler app logic"], cons: ["Minority side unavailable during partitions", "Higher latency"] },
      { option: "AP", pros: ["Always answers", "Low latency"], cons: ["Stale reads", "Conflict resolution needed"] },
    ],
    pitfalls: ["Claiming a distributed DB is 'CA'", "Using LWW for money", "Ignoring latency cost of consensus in every request"],
    interview: ["Pick C or A per feature, not per system.", "Name the consistency model each read path needs."],
    lab: [{ href: "/lab/algorithms?tab=quorum", label: "Quorum lab" }],
  },

  {
    slug: "consensus",
    track: "data",
    title: "Consensus with Raft",
    subtitle: "Leader election, log replication, terms and majorities: how clusters agree.",
    level: "expert",
    minutes: 22,
    quizTopic: "consensus",
    scene: {
      nodes: [
        { id: "n1", type: "server", label: "N1", pos: [0, -4] },
        { id: "n2", type: "server", label: "N2", pos: [3.8, -1.2] },
        { id: "n3", type: "server", label: "N3", pos: [2.4, 3.3] },
        { id: "n4", type: "server", label: "N4", pos: [-2.4, 3.3] },
        { id: "n5", type: "server", label: "N5", pos: [-3.8, -1.2] },
      ],
      edges: [["n1", "n2"], ["n1", "n3"], ["n1", "n4"], ["n1", "n5"], ["n2", "n3"], ["n3", "n4"], ["n4", "n5"], ["n5", "n2"], ["n2", "n4"], ["n3", "n5"]],
    },
    steps: [
      {
        title: "Everyone starts as a follower",
        body: "Each node waits a **randomised election timeout** (150–300 ms). Followers expect heartbeats from a leader; none exists yet.",
        badges: { n1: "term 0", n2: "term 0", n3: "term 0", n4: "term 0", n5: "term 0" },
        flows: [],
      },
      {
        title: "A candidate asks for votes",
        body: "N1 times out first, increments its **term** to 1, votes for itself and sends `RequestVote` to all peers. Each node grants at most one vote per term, only to candidates whose log is at least as up to date.",
        focus: ["n1"],
        badges: { n1: "candidate · t1" },
        flows: [["n1", "n2", C.vote, 1], ["n1", "n3", C.vote, 1], ["n1", "n4", C.vote, 1], ["n1", "n5", C.vote, 1]],
      },
      {
        title: "Majority ⇒ leader",
        body: "With 3 of 5 votes N1 becomes **leader** for term 1. Any two majorities overlap in at least one node, so two leaders can never win the same term.",
        focus: ["n1"],
        badges: { n1: "LEADER · t1" },
        flows: [["n2", "n1", C.ok, 1], ["n3", "n1", C.ok, 1], ["n4", "n1", C.ok, 1]],
      },
      {
        title: "Log replication",
        body: "Clients send commands to the leader. It appends to its log and sends `AppendEntries` to followers. Once a **majority** has the entry, it is *committed* and applied to the state machine.",
        badges: { n1: "log [1,1,1]", n2: "[1,1,1]", n3: "[1,1,1]", n4: "[1,1]", n5: "[1]" },
        flows: [["n1", "n2", C.write, 1.2], ["n1", "n3", C.write, 1.2], ["n1", "n4", C.write, 1.2], ["n1", "n5", C.write, 1.2]],
      },
      {
        title: "Leader crashes",
        body: "Heartbeats stop. N3 times out, starts term 2 and wins with N2, N4, N5. Committed entries survive because they are on a majority, and the election rule only elects candidates that have them.",
        down: ["n1"],
        focus: ["n3"],
        badges: { n3: "LEADER · t2" },
        flows: [["n3", "n2", C.write, 1], ["n3", "n4", C.write, 1], ["n3", "n5", C.write, 1]],
      },
    ],
    sections: [
      {
        title: "Why consensus",
        body: `Many problems reduce to *agreeing on one value or one ordered log* despite crashes: leader election, distributed locks, configuration, metadata, replicated state machines. Raft (etcd, Consul, CockroachDB, TiKV, Kafka KRaft) and Paxos/Multi-Paxos (Chubby, Spanner) solve it, with **2f + 1** nodes tolerating **f** failures.`,
      },
      {
        title: "Safety rules that matter",
        body: `- **Election restriction**: a voter rejects candidates whose last log term/index is older than its own.
- **Log matching**: AppendEntries carries (prevIndex, prevTerm); followers reject if they don't match, and the leader backs up until logs agree, then overwrites the follower's suffix.
- **Commit rule**: a leader only commits entries from its *current term* by counting replicas; earlier entries commit indirectly.
- **Terms** act as a logical clock: any message with a higher term makes a node step down.`,
      },
      {
        title: "Partitions",
        body: `A leader stranded in a minority keeps accepting writes but can never commit them. The majority elects a new leader in a higher term. When the partition heals the old leader sees the higher term, steps down, and its uncommitted entries are overwritten. Run this exact scenario in the **Raft lab**.`,
      },
      {
        title: "Operational notes",
        body: `- Keep clusters small (3 or 5). More nodes = slower commits.
- Spread across failure domains (3 AZs).
- Consensus is for metadata and coordination; don't push high-volume data through one Raft group. Shard into many groups (Multi-Raft).
- Reads: linearizable reads need a heartbeat round (ReadIndex) or leader leases.`,
      },
    ],
    keyNumbers: [
      { label: "Nodes to tolerate 1 / 2 failures", value: "3 / 5" },
      { label: "Election timeout", value: "150–300 ms (LAN)" },
      { label: "Heartbeat", value: "~50 ms" },
      { label: "Commit latency", value: "1 RTT to majority + fsync" },
    ],
    pitfalls: ["Even-sized clusters (4 tolerates the same as 3)", "Election timeouts shorter than network jitter", "Using consensus for bulk data paths"],
    interview: ["Explain why majorities prevent split brain.", "Describe what happens to writes in a minority partition."],
    lab: [{ href: "/lab/algorithms?tab=raft", label: "Raft simulator" }],
  },
];
