"""Rate limiting algorithms run side-by-side over the same request stream."""
from __future__ import annotations

import math
import random
from collections import deque


def gen_traffic(pattern: str, rate: float, duration: float, seed: int = 1) -> list[float]:
    rng = random.Random(seed)
    ts: list[float] = []
    if pattern == "steady":
        step = 1 / rate
        t = 0.0
        while t < duration:
            ts.append(round(t, 4))
            t += step
    elif pattern == "burst":
        # quiet background + dense bursts every 3s
        t = 0.0
        while t < duration:
            t += rng.expovariate(rate * 0.3)
            ts.append(t)
        for b in range(int(duration // 3)):
            start = b * 3 + 1.0
            for i in range(int(rate * 1.5)):
                ts.append(start + i * (0.25 / (rate * 1.5)))
    elif pattern == "boundary":
        # all traffic clustered around window edges: exposes fixed-window double-burst
        for sec in range(1, int(duration)):
            for i in range(int(rate)):
                ts.append(sec - 0.05 + i * (0.1 / rate))
    else:  # poisson
        t = 0.0
        while t < duration:
            t += rng.expovariate(rate)
            ts.append(t)
    return sorted(x for x in ts if 0 <= x < duration)


class TokenBucket:
    name = "Token bucket"

    def __init__(self, limit, window, burst):
        self.cap = burst
        self.rate = limit / window
        self.tokens = burst
        self.last = 0.0

    def allow(self, t):
        self.tokens = min(self.cap, self.tokens + (t - self.last) * self.rate)
        self.last = t
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False

    def state(self):
        return round(self.tokens, 2)


class LeakyBucket:
    name = "Leaky bucket"

    def __init__(self, limit, window, burst):
        self.cap = burst
        self.rate = limit / window
        self.water = 0.0
        self.last = 0.0

    def allow(self, t):
        self.water = max(0.0, self.water - (t - self.last) * self.rate)
        self.last = t
        if self.water + 1 <= self.cap:
            self.water += 1
            return True
        return False

    def state(self):
        return round(self.water, 2)


class FixedWindow:
    name = "Fixed window"

    def __init__(self, limit, window, burst):
        self.limit, self.window = limit, window
        self.cur, self.count = -1, 0

    def allow(self, t):
        w = int(t // self.window)
        if w != self.cur:
            self.cur, self.count = w, 0
        if self.count < self.limit:
            self.count += 1
            return True
        return False

    def state(self):
        return self.count


class SlidingLog:
    name = "Sliding log"

    def __init__(self, limit, window, burst):
        self.limit, self.window = limit, window
        self.log: deque[float] = deque()

    def allow(self, t):
        while self.log and self.log[0] <= t - self.window:
            self.log.popleft()
        if len(self.log) < self.limit:
            self.log.append(t)
            return True
        return False

    def state(self):
        return len(self.log)


class SlidingCounter:
    name = "Sliding window counter"

    def __init__(self, limit, window, burst):
        self.limit, self.window = limit, window
        self.cur, self.cur_count, self.prev_count = 0, 0, 0
        self.est = 0.0

    def allow(self, t):
        w = int(t // self.window)
        if w != self.cur:
            self.prev_count = self.cur_count if w == self.cur + 1 else 0
            self.cur, self.cur_count = w, 0
        frac = (t % self.window) / self.window
        self.est = self.prev_count * (1 - frac) + self.cur_count
        if self.est < self.limit:
            self.cur_count += 1
            return True
        return False

    def state(self):
        return round(self.est, 2)


ALGOS = {
    "token_bucket": TokenBucket,
    "leaky_bucket": LeakyBucket,
    "fixed_window": FixedWindow,
    "sliding_log": SlidingLog,
    "sliding_counter": SlidingCounter,
}

MEMORY = {
    "token_bucket": "O(1): tokens + last refill timestamp",
    "leaky_bucket": "O(1): water level + timestamp (or a FIFO queue when shaping)",
    "fixed_window": "O(1): one counter per window",
    "sliding_log": "O(limit): one timestamp per accepted request",
    "sliding_counter": "O(1): current + previous window counters",
}


def rate_limit_lab(pattern: str, rate: float, duration: float, limit: int, window: float,
                   burst: int, algorithms: list[str] | None = None, seed: int = 1) -> dict:
    ts = gen_traffic(pattern, rate, duration, seed)
    algos = algorithms or list(ALGOS)
    buckets = max(1, int(math.ceil(duration / 0.25)))
    out = {}
    for a in algos:
        lim = ALGOS[a](limit, window, burst)
        allowed_series = [0] * buckets
        denied_series = [0] * buckets
        state_series = [0.0] * buckets
        allowed = 0
        max_in_any_window = 0
        acc: deque[float] = deque()
        for t in ts:
            ok = lim.allow(t)
            b = min(buckets - 1, int(t / 0.25))
            if ok:
                allowed += 1
                allowed_series[b] += 1
                acc.append(t)
                while acc and acc[0] <= t - window:
                    acc.popleft()
                max_in_any_window = max(max_in_any_window, len(acc))
            else:
                denied_series[b] += 1
            state_series[b] = lim.state()
        out[a] = {
            "name": ALGOS[a].name,
            "allowed": allowed,
            "denied": len(ts) - allowed,
            "allowed_series": allowed_series,
            "denied_series": denied_series,
            "state_series": state_series,
            "max_in_any_window": max_in_any_window,
            "overshoot": max(0, max_in_any_window - limit),
            "memory": MEMORY[a],
        }
    return {"total_requests": len(ts), "bucket_seconds": 0.25, "limit": limit, "window": window,
            "algorithms": out}
