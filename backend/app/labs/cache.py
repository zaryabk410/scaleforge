"""Cache eviction policy lab: LRU, LFU, FIFO, Random, TinyLFU-ish admission (W-TinyLFU lite)."""
from __future__ import annotations

import bisect
import random
from collections import Counter, OrderedDict, deque


def zipf_trace(num_keys: int, length: int, alpha: float, seed: int, scan_every: int = 0) -> list[int]:
    rng = random.Random(seed)
    weights = [1 / ((i + 1) ** alpha) for i in range(num_keys)]
    cum = []
    s = 0.0
    for w in weights:
        s += w
        cum.append(s)
    perm = list(range(num_keys))
    rng.shuffle(perm)
    trace = []
    scan_key = num_keys
    for i in range(length):
        if scan_every and i % scan_every == 0 and i:
            # one-hit-wonder scan (e.g. a batch job / crawler) that pollutes recency caches
            for _ in range(max(1, length // 40)):
                trace.append(scan_key)
                scan_key += 1
        x = rng.random() * s
        trace.append(perm[bisect.bisect_left(cum, x)])
    return trace[:length]


class LRU:
    def __init__(self, cap):
        self.cap, self.d = cap, OrderedDict()

    def access(self, k):
        if k in self.d:
            self.d.move_to_end(k)
            return True
        self.d[k] = 1
        if len(self.d) > self.cap:
            self.d.popitem(last=False)
        return False

    def contents(self):
        return list(self.d.keys())


class FIFO:
    def __init__(self, cap):
        self.cap, self.q, self.s = cap, deque(), set()

    def access(self, k):
        if k in self.s:
            return True
        self.q.append(k)
        self.s.add(k)
        if len(self.q) > self.cap:
            self.s.discard(self.q.popleft())
        return False

    def contents(self):
        return list(self.q)


class LFU:
    def __init__(self, cap):
        self.cap, self.freq, self.tick, self.last = cap, {}, 0, {}

    def access(self, k):
        self.tick += 1
        if k in self.freq:
            self.freq[k] += 1
            self.last[k] = self.tick
            return True
        if len(self.freq) >= self.cap:
            victim = min(self.freq, key=lambda x: (self.freq[x], self.last[x]))
            del self.freq[victim], self.last[victim]
        self.freq[k] = 1
        self.last[k] = self.tick
        return False

    def contents(self):
        return sorted(self.freq, key=lambda x: -self.freq[x])


class RandomEvict:
    def __init__(self, cap, seed=9):
        self.cap, self.items, self.idx, self.rng = cap, [], {}, random.Random(seed)

    def access(self, k):
        if k in self.idx:
            return True
        if len(self.items) >= self.cap:
            i = self.rng.randrange(len(self.items))
            victim = self.items[i]
            last = self.items.pop()
            if i < len(self.items):
                self.items[i] = last
                self.idx[last] = i
            del self.idx[victim]
        self.idx[k] = len(self.items)
        self.items.append(k)
        return False

    def contents(self):
        return list(self.items)


class TinyLFU:
    """LRU main cache with a frequency-sketch admission filter (simplified W-TinyLFU)."""

    def __init__(self, cap):
        self.cap, self.d, self.seen, self.ops = cap, OrderedDict(), Counter(), 0

    def access(self, k):
        self.seen[k] += 1
        self.ops += 1
        if self.ops % (self.cap * 10) == 0:  # aging: halve counters
            self.seen = Counter({x: c // 2 for x, c in self.seen.items() if c > 1})
        if k in self.d:
            self.d.move_to_end(k)
            return True
        if len(self.d) < self.cap:
            self.d[k] = 1
            return False
        victim = next(iter(self.d))
        if self.seen[k] > self.seen[victim]:
            self.d.popitem(last=False)
            self.d[k] = 1
        return False

    def contents(self):
        return list(self.d.keys())


POLICIES = {"lru": LRU, "lfu": LFU, "fifo": FIFO, "random": RandomEvict, "tinylfu": TinyLFU}
NAMES = {"lru": "LRU", "lfu": "LFU", "fifo": "FIFO", "random": "Random", "tinylfu": "W-TinyLFU (lite)"}


def cache_lab(capacity: int, num_keys: int, length: int, alpha: float, scan: bool,
              policies: list[str] | None = None, seed: int = 5) -> dict:
    trace = zipf_trace(num_keys, length, alpha, seed, scan_every=length // 5 if scan else 0)
    pols = policies or list(POLICIES)
    buckets = 40
    size = max(1, len(trace) // buckets)
    out = {}
    for p in pols:
        c = POLICIES[p](capacity)
        hits = 0
        curve = []
        steps = []
        window_hits = 0
        for i, k in enumerate(trace):
            hit = c.access(k)
            hits += hit
            window_hits += hit
            if (i + 1) % size == 0:
                curve.append(round(100 * window_hits / size, 1))
                window_hits = 0
            if i < 40:
                steps.append({"key": k, "hit": hit, "cache": c.contents()[:capacity][:12]})
        out[p] = {"name": NAMES[p], "hit_rate": round(100 * hits / len(trace), 2),
                  "curve": curve, "steps": steps}
    # Belady's optimal (offline upper bound) for reference
    out["optimal"] = {"name": "Belady (optimal, offline)", "hit_rate": _belady(trace, capacity),
                      "curve": [], "steps": []}
    top = Counter(trace).most_common(capacity)
    return {"trace_length": len(trace), "unique_keys": len(set(trace)),
            "top_k_share": round(100 * sum(c for _, c in top) / len(trace), 2),
            "policies": out}


def _belady(trace: list[int], cap: int) -> float:
    nxt = [0] * len(trace)
    last: dict[int, int] = {}
    for i in range(len(trace) - 1, -1, -1):
        nxt[i] = last.get(trace[i], 1 << 30)
        last[trace[i]] = i
    import heapq
    cache: dict[int, int] = {}
    heap: list[tuple[int, int]] = []
    hits = 0
    for i, k in enumerate(trace):
        if k in cache:
            hits += 1
        elif len(cache) >= cap:
            while heap:
                neg, key = heapq.heappop(heap)
                if key in cache and cache[key] == -neg:
                    del cache[key]
                    break
        cache[k] = nxt[i]
        heapq.heappush(heap, (-nxt[i], k))
    return round(100 * hits / len(trace), 2)
