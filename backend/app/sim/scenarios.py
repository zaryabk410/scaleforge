"""Lab challenges: a traffic profile + chaos + pass criteria, graded by simulation."""
from __future__ import annotations

from .analyzer import review
from .engine import simulate
from .models import ChaosEvent, EdgeSpec, NodeSpec, SimRequest, TrafficSpec


def _n(id, type, x, y, **kw):
    return {"id": id, "type": type, "x": x, "y": y, **kw}


STARTER_BASIC = {
    "nodes": [_n("client", "client", 80, 200, label="Users"),
              _n("app", "server", 340, 200, label="App Server"),
              _n("db", "db", 600, 200, label="Postgres")],
    "edges": [{"source": "client", "target": "app"}, {"source": "app", "target": "db"}],
}

SCENARIOS: list[dict] = [
    {
        "id": "hello-scale",
        "title": "Hello, Scale",
        "difficulty": "beginner",
        "story": "Your side project hit the front page. 1,500 requests/s, mostly reads. "
                 "One server and one database will not survive. Keep it fast and up.",
        "traffic": {"rps": 1500, "read_ratio": 0.9, "duration": 60, "pattern": "steady"},
        "chaos": [],
        "criteria": {"p99_max": 400, "error_rate_max": 0.01},
        "hints": ["A single App Server handles ~1,000 req/s. Add replicas.",
                  "Replicas need a Load Balancer in front so traffic is spread and failures are routed around."],
        "concepts": ["horizontal-scaling", "load-balancing"],
        "starter": STARTER_BASIC,
    },
    {
        "id": "read-heavy-feed",
        "title": "Read-Heavy News Feed",
        "difficulty": "intermediate",
        "story": "A social feed serves 15,000 req/s with 95% reads. The database melts first. "
                 "Hit the latency target on a budget.",
        "traffic": {"rps": 15000, "read_ratio": 0.95, "duration": 60, "pattern": "steady"},
        "chaos": [],
        "criteria": {"p99_max": 300, "error_rate_max": 0.005, "cost_max": 4500},
        "hints": ["Reads dominate: a cache in front of the DB absorbs most of them.",
                  "Cache-aside: connect the App Servers to both the Cache and the DB.",
                  "Postgres needs read replicas or the primary is a SPOF."],
        "concepts": ["caching", "replication"],
        "starter": STARTER_BASIC,
    },
    {
        "id": "black-friday",
        "title": "Black Friday Spike",
        "difficulty": "intermediate",
        "story": "Baseline is 3,000 req/s, but at t=20s a flash sale ramps traffic to 5x for 20 seconds. "
                 "Overprovisioning for the peak all month is expensive.",
        "traffic": {"rps": 3000, "read_ratio": 0.95, "duration": 70, "pattern": "spike",
                    "spike_multiplier": 5, "spike_at": 20, "spike_duration": 20},
        "chaos": [],
        "criteria": {"error_rate_max": 0.03, "p99_max": 1500, "cost_max": 3000},
        "hints": ["Turn on autoscaling for the App Server tier (min/max replicas).",
                  "New instances take ~3s to boot: keep headroom with a higher min replicas (try 8).",
                  "A cache keeps the DB out of the blast radius."],
        "concepts": ["autoscaling", "caching"],
        "starter": STARTER_BASIC,
    },
    {
        "id": "no-spof",
        "title": "Kill Anything",
        "difficulty": "intermediate",
        "story": "Chaos engineering day. At t=15s an entire App Server group dies, at t=30s a Load "
                 "Balancer instance and the database primary go down. Users must not notice.",
        "traffic": {"rps": 4000, "read_ratio": 0.9, "duration": 60, "pattern": "steady"},
        "chaos": [{"node_type": "server", "at": 15},
                  {"node_type": "lb", "at": 30, "replicas": 1},
                  {"node_type": "db", "at": 30, "replicas": 1}],
        "criteria": {"error_rate_max": 0.02, "p99_max": 600, "no_spof": True},
        "hints": ["Run two independent App Server groups behind the load balancer.",
                  "Give the Load Balancer 2 replicas.",
                  "Database: add a read replica so a standby can take over."],
        "concepts": ["redundancy", "failover"],
        "starter": STARTER_BASIC,
    },
    {
        "id": "write-firehose",
        "title": "Telemetry Firehose",
        "difficulty": "advanced",
        "story": "IoT devices push 10,000 events/s (80% writes). Devices only need an ACK fast; "
                 "data must land in storage within the run.",
        "traffic": {"rps": 10000, "read_ratio": 0.2, "duration": 60, "pattern": "steady"},
        "chaos": [],
        "criteria": {"error_rate_max": 0.005, "p99_max": 250, "backlog_max": 20000, "async_failures_max": 0},
        "hints": ["Writes should go App Server -> Queue -> Workers -> Store.",
                  "A queue ACKs in ~2ms: write latency collapses.",
                  "Workers handle ~600 msg/s each; the store needs enough write capacity (NoSQL or shards)."],
        "concepts": ["queues", "write-path", "sharding"],
        "starter": STARTER_BASIC,
    },
    {
        "id": "cache-stampede",
        "title": "Cache Stampede",
        "difficulty": "advanced",
        "story": "12,000 reads/s are served by a cache. At t=20s the cache cluster dies for 15 seconds and "
                 "every request falls through to the database.",
        "traffic": {"rps": 12000, "read_ratio": 0.97, "duration": 60, "pattern": "steady"},
        "chaos": [{"node_type": "cache", "at": 20, "recover_at": 35}],
        "criteria": {"error_rate_max": 0.05, "p99_max": 3000},
        "hints": ["The database must survive a full miss storm, or something else must absorb it.",
                  "Read replicas multiply read capacity.",
                  "A CDN in front of the origin keeps serving popular content when the cache is gone."],
        "concepts": ["caching", "resilience", "cdn"],
        "starter": STARTER_BASIC,
    },
    {
        "id": "global-video",
        "title": "Global Video Platform",
        "difficulty": "advanced",
        "story": "30,000 req/s worldwide (peaking at 42,000), 98% reads of thumbnails, manifests and metadata. "
                 "Users are far from your region: every origin round trip costs ~40ms.",
        "traffic": {"rps": 30000, "read_ratio": 0.98, "duration": 60, "pattern": "diurnal", "spike_multiplier": 1.4},
        "chaos": [],
        "criteria": {"p99_max": 220, "error_rate_max": 0.005, "cost_max": 4000},
        "hints": ["A CDN serves cached content ~8ms from users and sheds origin load.",
                  "Behind the CDN: LB -> App tier -> Cache -> DB.",
                  "Raise the CDN hit rate (immutable assets can be cached for a long time)."],
        "concepts": ["cdn", "caching", "global"],
        "starter": STARTER_BASIC,
    },
    {
        "id": "sharded-ledger",
        "title": "Sharded Ledger",
        "difficulty": "expert",
        "story": "A payments ledger takes 12,000 req/s at 50% writes. Writes must be synchronous "
                 "(no queue: money needs a durable commit before ACK).",
        "traffic": {"rps": 12000, "read_ratio": 0.5, "duration": 60, "pattern": "steady"},
        "chaos": [{"node_type": "server", "at": 30, "replicas": 2}],
        "criteria": {"p99_max": 500, "error_rate_max": 0.005, "no_queue": True, "no_spof": True},
        "hints": ["One primary handles ~1,250 writes/s. Shard the DB by account id.",
                  "Each shard needs a replica for failover.",
                  "Overprovision the app tier so losing 2 replicas does not hurt."],
        "concepts": ["sharding", "replication", "consistency"],
        "starter": STARTER_BASIC,
    },
]

SCENARIO_MAP = {s["id"]: s for s in SCENARIOS}


def public(s: dict) -> dict:
    return {k: v for k, v in s.items()}


def grade(scenario_id: str, nodes: list[dict], edges: list[dict]) -> dict:
    s = SCENARIO_MAP.get(scenario_id)
    if not s:
        raise KeyError(scenario_id)
    req = SimRequest(
        nodes=[NodeSpec(**n) for n in nodes],
        edges=[EdgeSpec(**e) for e in edges],
        traffic=TrafficSpec(**s["traffic"]),
        chaos=[ChaosEvent(**c) for c in s["chaos"]],
    )
    result = simulate(req)
    findings = review(req, result)
    summ = result["summary"]
    crit = s["criteria"]
    checks = []

    def check(name, ok, actual, target):
        checks.append({"name": name, "passed": bool(ok), "actual": actual, "target": target})

    if "p99_max" in crit:
        check("p99 latency", summ["p99"] <= crit["p99_max"], f"{summ['p99']} ms", f"<= {crit['p99_max']} ms")
    if "error_rate_max" in crit:
        check("Error rate", summ["error_rate"] <= crit["error_rate_max"],
              f"{summ['error_rate'] * 100:.2f}%", f"<= {crit['error_rate_max'] * 100:.2f}%")
    if "cost_max" in crit:
        check("Monthly cost", summ["monthly_cost"] <= crit["cost_max"],
              f"${summ['monthly_cost']:,}", f"<= ${crit['cost_max']:,}")
    if "backlog_max" in crit:
        check("Final queue backlog", summ["final_backlog"] <= crit["backlog_max"],
              f"{summ['final_backlog']:,}", f"<= {crit['backlog_max']:,}")
    if "async_failures_max" in crit:
        check("Async write failures", summ["async_failures"] <= crit["async_failures_max"],
              f"{summ['async_failures']:,}", f"<= {crit['async_failures_max']}")
    if crit.get("no_spof"):
        spofs = [f for f in findings if f["code"] == "SPOF"]
        check("No single point of failure", not spofs, f"{len(spofs)} SPOF(s)", "0")
    if crit.get("no_queue"):
        has_q = any(n["type"] == "queue" for n in nodes)
        check("Synchronous writes (no queue)", not has_q, "queue present" if has_q else "none", "no queue")
    if scenario_id == "write-firehose":
        has_q = any(n["type"] == "queue" for n in nodes)
        check("Uses a queue on the write path", has_q, "yes" if has_q else "no", "yes")

    passed = sum(c["passed"] for c in checks)
    score = round(100 * passed / len(checks)) if checks else 0
    return {
        "scenario": scenario_id,
        "passed": passed == len(checks),
        "score": score,
        "checks": checks,
        "findings": findings,
        "result": result,
    }
