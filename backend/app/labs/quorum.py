"""Leaderless replication quorum lab (Dynamo-style N/R/W)."""
from __future__ import annotations

import random


def quorum_lab(n: int, r: int, w: int, failed: int, replication_ms: float,
               read_delay_ms: float, trials: int = 4000, seed: int = 11) -> dict:
    if not (1 <= r <= n and 1 <= w <= n):
        raise ValueError("R and W must be between 1 and N")
    if failed >= n:
        raise ValueError("at least one replica must be alive")
    rng = random.Random(seed)
    alive = n - failed
    write_ok = alive >= w
    read_ok = alive >= r
    stale = 0
    latencies_w, latencies_r = [], []
    for _ in range(trials):
        nodes = list(range(n))
        dead = set(rng.sample(nodes, failed))
        live = [x for x in nodes if x not in dead]
        # write: coordinator sends to all live; acks arrive with random latency
        apply_at = {x: rng.expovariate(1 / replication_ms) for x in live}
        acks = sorted(apply_at.values())
        if len(acks) < w:
            continue
        latencies_w.append(acks[w - 1])
        # read issued read_delay_ms after the write was acknowledged
        t_read = acks[w - 1] + read_delay_ms
        if len(live) < r:
            continue
        chosen = rng.sample(live, len(live))  # replicas respond in random order
        responders = chosen[:r]
        latencies_r.append(max(rng.expovariate(1 / 2.0) for _ in responders))
        if not any(apply_at[x] <= t_read for x in responders):
            stale += 1
    reads = max(1, len(latencies_r))
    pct = lambda xs, p: round(sorted(xs)[int(len(xs) * p)] if xs else 0, 2)
    strong = r + w > n
    return {
        "n": n, "r": r, "w": w, "failed": failed,
        "strong_quorum": strong,
        "overlap": r + w - n,
        "write_available": write_ok,
        "read_available": read_ok,
        "stale_read_pct": round(100 * stale / reads, 3) if read_ok and write_ok else None,
        "write_p50": pct(latencies_w, 0.5), "write_p99": pct(latencies_w, 0.99),
        "read_p50": pct(latencies_r, 0.5), "read_p99": pct(latencies_r, 0.99),
        "tolerates_failures": {"writes": n - w, "reads": n - r},
        "explanation": (
            f"R + W = {r + w} {'>' if strong else '<='} N = {n}: every read quorum "
            + ("overlaps every write quorum, so a read always sees the latest acknowledged write "
               "(ignoring sloppy quorums / hinted handoff)." if strong else
               "can miss the replicas that took the write; reads may be stale until anti-entropy catches up.")
        ),
    }
