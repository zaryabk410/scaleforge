"""Consistent hashing vs modulo hashing, and sharding strategy lab."""
from __future__ import annotations

import bisect
import hashlib
import math
import random
import statistics

RING = 2 ** 32


def h32(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)


class Ring:
    def __init__(self, nodes: list[str], vnodes: int):
        self.points: list[tuple[int, str]] = sorted(
            (h32(f"{n}#vn{i}"), n) for n in nodes for i in range(vnodes))
        self.keys = [p[0] for p in self.points]

    def lookup(self, key: str) -> str:
        if not self.points:
            raise ValueError("ring is empty")
        i = bisect.bisect(self.keys, h32(key)) % len(self.points)
        return self.points[i][1]


def _dist(assign: dict[str, str], nodes: list[str]) -> dict[str, int]:
    d = {n: 0 for n in nodes}
    for v in assign.values():
        d[v] += 1
    return d


def _cv(counts: list[int]) -> float:
    if len(counts) < 2:
        return 0.0
    m = statistics.mean(counts)
    return round(100 * statistics.pstdev(counts) / m, 2) if m else 0.0


def consistent_hash_lab(nodes: list[str], vnodes: int, num_keys: int,
                        add: str | None = None, remove: str | None = None) -> dict:
    if not nodes:
        raise ValueError("need at least one node")
    keys = [f"user:{i}" for i in range(num_keys)]
    after_nodes = [n for n in nodes if n != remove] + ([add] if add and add not in nodes else [])
    if not after_nodes:
        raise ValueError("cannot remove the last node")

    ring_b, ring_a = Ring(nodes, vnodes), Ring(after_nodes, vnodes)
    before = {k: ring_b.lookup(k) for k in keys}
    after = {k: ring_a.lookup(k) for k in keys}
    moved = sum(before[k] != after[k] for k in keys)

    mod_b = {k: nodes[h32(k) % len(nodes)] for k in keys}
    mod_a = {k: after_nodes[h32(k) % len(after_nodes)] for k in keys}
    mod_moved = sum(mod_b[k] != mod_a[k] for k in keys)

    d_before, d_after = _dist(before, nodes), _dist(after, after_nodes)
    sample = [{"key": k, "pos": h32(k) / RING, "node": after[k], "moved": before[k] != after[k]}
              for k in keys[:150]]
    return {
        "ring": [{"pos": p / RING, "node": n} for p, n in ring_a.points],
        "ring_before": [{"pos": p / RING, "node": n} for p, n in ring_b.points],
        "distribution_before": d_before,
        "distribution_after": d_after,
        "imbalance_cv_before": _cv(list(d_before.values())),
        "imbalance_cv_after": _cv(list(d_after.values())),
        "moved_pct": round(100 * moved / num_keys, 2),
        "modulo_moved_pct": round(100 * mod_moved / num_keys, 2),
        "ideal_moved_pct": round(100 * (1 / max(len(nodes), len(after_nodes))), 2) if (add or remove) else 0,
        "keys_sample": sample,
        "nodes_after": after_nodes,
    }


def _zipf_weights(n: int, alpha: float) -> list[float]:
    w = [1 / ((i + 1) ** alpha) for i in range(n)]
    s = sum(w)
    return [x / s for x in w]


def sharding_lab(strategy: str, shards: int, num_keys: int, key_pattern: str,
                 access_skew: float, seed: int = 7) -> dict:
    """strategy: hash | range | consistent | directory. key_pattern: uniform | sequential | skewed."""
    rng = random.Random(seed)
    if key_pattern == "sequential":
        keys = list(range(num_keys))  # e.g. auto-increment ids / timestamps
    elif key_pattern == "skewed":
        keys = sorted(int(rng.paretovariate(1.2) * 1000) % (num_keys * 10) for _ in range(num_keys))
    else:
        keys = rng.sample(range(num_keys * 10), num_keys)
    key_space = max(keys) + 1

    if strategy == "range":
        bounds = [key_space * (i + 1) / shards for i in range(shards)]
        shard_of = lambda k: min(bisect.bisect_right(bounds, k), shards - 1)
    elif strategy == "consistent":
        ring = Ring([f"s{i}" for i in range(shards)], 64)
        shard_of = lambda k: int(ring.lookup(str(k))[1:])
    elif strategy == "directory":
        # lookup table placing keys round-robin by insert order; perfectly balanced, extra hop
        table = {k: i % shards for i, k in enumerate(keys)}
        shard_of = lambda k: table[k]
    else:
        shard_of = lambda k: h32(str(k)) % shards

    counts = [0] * shards
    for k in keys:
        counts[shard_of(k)] += 1

    # access load: newest / most popular keys get more traffic
    weights = _zipf_weights(len(keys), access_skew) if access_skew > 0 else [1 / len(keys)] * len(keys)
    order = list(reversed(keys)) if key_pattern == "sequential" else keys[:]
    if key_pattern != "sequential":
        rng.shuffle(order)
    load = [0.0] * shards
    for k, w in zip(order, weights):
        load[shard_of(k)] += w
    load_pct = [round(100 * x, 2) for x in load]
    hottest = max(range(shards), key=lambda i: load[i])
    fair = 100 / shards
    return {
        "strategy": strategy,
        "counts": counts,
        "load_pct": load_pct,
        "hottest_shard": hottest,
        "hotspot_factor": round(load_pct[hottest] / fair, 2),
        "storage_cv": _cv(counts),
        "verdict": _verdict(strategy, key_pattern, load_pct[hottest] / fair),
    }


def _verdict(strategy: str, pattern: str, factor: float) -> str:
    if factor >= 2.5:
        if strategy == "range" and pattern == "sequential":
            return "Hot shard: range sharding on a monotonically increasing key sends every new write to the last shard."
        return "Hot shard: a few keys carry most of the traffic. Consider key salting, splitting hot keys, or caching them."
    if factor >= 1.4:
        return "Noticeable skew. Acceptable for storage, but watch the hottest shard's CPU and IOPS."
    if strategy == "range":
        return "Balanced, and range sharding keeps range scans cheap (single-shard queries)."
    if strategy == "directory":
        return "Balanced, at the cost of a lookup service that must be highly available and cached."
    return "Balanced. Hash-based placement spreads keys evenly but makes range queries scatter-gather."


def estimate_shards(write_qps: float, read_qps: float, storage_tb: float,
                    per_shard_write: float = 1500, per_shard_read: float = 6000,
                    per_shard_tb: float = 2.0) -> dict:
    need = {
        "writes": math.ceil(write_qps / per_shard_write) if write_qps else 1,
        "reads": math.ceil(read_qps / per_shard_read) if read_qps else 1,
        "storage": math.ceil(storage_tb / per_shard_tb) if storage_tb else 1,
    }
    n = max(need.values())
    return {"needed": need, "shards": n, "with_headroom": math.ceil(n * 1.5)}
