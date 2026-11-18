"""Static + dynamic architecture review: SPOFs, anti-patterns, hot spots."""
from __future__ import annotations

from collections import deque

from .engine import DATA_TYPES, Simulator
from .models import SimRequest

MANAGED = {"cdn", "dns", "storage", "client"}  # treated as inherently redundant


def _reachable(sim: Simulator, removed: str | None) -> set[str]:
    starts = [k for k, n in sim.nodes.items() if n.type == "client" and k != removed]
    seen = set(starts)
    dq = deque(starts)
    while dq:
        k = dq.popleft()
        for c in sim.nodes[k].children:  # real edges only
            if c != removed and c not in seen:
                seen.add(c)
                dq.append(c)
    return seen


def _redundant(n) -> bool:
    if n.type in MANAGED:
        return True
    if n.type in ("db", "nosql", "search"):
        return n.spec.read_replicas >= 1 or n.replicas >= 2
    if n.spec.autoscale and n.spec.min_replicas >= 2:
        return True
    return n.replicas >= 2


def review(req: SimRequest, result: dict | None = None) -> list[dict]:
    sim = Simulator(req)
    tr = req.traffic
    out: list[dict] = []

    def add(level, code, msg, node=None, fix=None):
        out.append({"level": level, "code": code, "message": msg, "node": node, "fix": fix})

    base = _reachable(sim, None)
    for k, n in sim.nodes.items():
        label = n.spec.label or k
        if k not in base:
            add("warn", "ORPHAN", f"{label} is not reachable from any client.", k,
                "Connect it into the request path or delete it.")
            continue
        if _redundant(n):
            continue
        if n.type == "cache" and not [c for c in n.children if sim.nodes[c].type in DATA_TYPES]:
            continue  # cache-aside: app falls back to the database
        after = _reachable(sim, k)
        lost = (base - {k}) - after
        if lost or n.type in DATA_TYPES:
            add("critical", "SPOF", f"{label} is a single point of failure"
                + (f" ({len(lost)} downstream component(s) become unreachable)." if lost else "."),
                k,
                "Add replicas (behind a load balancer) or a read replica / standby for databases.")

    types = [n.type for n in sim.nodes.values()]
    peak = tr.rps * (tr.spike_multiplier if tr.pattern != "steady" else 1)
    reads = peak * tr.read_ratio
    writes = peak * (1 - tr.read_ratio)

    if tr.read_ratio >= 0.7 and reads > 2_000 and "cache" not in types and "cdn" not in types:
        add("warn", "NO_CACHE", f"Read-heavy workload (~{int(reads):,} reads/s at peak) with no cache or CDN.",
            None, "Put a cache (Redis/Memcached) in front of the database; cache-aside is the usual start.")
    if writes > 3_000 and "queue" not in types:
        add("warn", "NO_QUEUE", f"~{int(writes):,} writes/s hit storage synchronously.",
            None, "Buffer writes through a queue/log (Kafka, SQS) and persist with workers.")
    for k, n in sim.nodes.items():
        if n.type == "client":
            servers = [c for c in n.children if sim.nodes[c].type == "server"]
            if servers:
                add("warn", "NO_LB", "Clients call application servers directly; no failover or even spread.",
                    k, "Place a load balancer or API gateway between clients and servers.")
        if n.type in ("db",) and n.spec.shards == 1 and writes > 4_000:
            add("info", "SHARD", f"{n.spec.label or k}: single write primary for ~{int(writes):,} writes/s.",
                k, "Shard by a high-cardinality key, or move hot write paths to a NoSQL store.")
        if n.type == "queue" and not [c for c in n.children if sim.nodes[c].type in ("worker", "server")]:
            add("critical", "NO_CONSUMER", f"{n.spec.label or k} has no consumers; messages will pile up.",
                k, "Connect workers to the queue.")
        if n.type == "lb" and len(n.children) == 1 and sim.nodes[n.children[0]].replicas == 1:
            add("info", "LB_ONE_TARGET", f"{n.spec.label or k} balances a single instance.",
                k, "Increase replicas on the target to get real redundancy.")
        if n.type == "cache" and (n.hit < 0.5):
            add("info", "LOW_HIT", f"{n.spec.label or k} hit rate {n.hit:.0%} is low.",
                k, "Cache hotter keys, increase TTL/size, or reconsider the cache.")

    if result:
        for k, s in result["nodes"].items():
            if s["type"] == "client":
                continue
            if s["peak_util"] >= 1.0:
                add("critical", "OVERLOAD", f"{s['label']} peaked at {s['peak_util']:.0%} utilisation and shed load.",
                    k, "Scale it out (replicas / autoscale), add caching upstream, or shard.")
            elif s["peak_util"] >= 0.8:
                add("warn", "HOT", f"{s['label']} peaked at {s['peak_util']:.0%}; little headroom for spikes.",
                    k, "Target ~60-70% peak utilisation to absorb bursts and failures.")
        summ = result["summary"]
        if summ["final_backlog"] > 0 and summ["final_backlog"] >= summ["peak_backlog"] * 0.9 and summ["peak_backlog"] > 1000:
            add("warn", "BACKLOG", f"Queue backlog still {summ['final_backlog']:,} at the end of the run.",
                None, "Add more workers or make consumers faster: the queue is not draining.")
        if summ["async_failures"] > 0:
            add("warn", "ASYNC_FAIL", f"{summ['async_failures']:,} async writes failed downstream of the queue.",
                None, "The store behind the workers is overloaded; scale or shard it, and use retries with DLQ.")

    order = {"critical": 0, "warn": 1, "info": 2}
    out.sort(key=lambda x: order[x["level"]])
    return out
