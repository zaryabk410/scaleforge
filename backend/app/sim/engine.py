"""Tick-based architecture simulator.

Each tick (1 simulated second) the engine:
  1. applies chaos / failures / autoscaling decisions,
  2. propagates the expected request rate through the graph in topological
     order (fluid model: utilisation, drops, queue backlog),
  3. samples individual requests through the same routing tables
     (Monte-Carlo) to build latency percentiles.

Service time per node follows an M/M/1-style curve: mean = base / (1 - rho).
Requests beyond capacity are shed (counted as errors).
"""
from __future__ import annotations

import math
import random
from collections import defaultdict
from dataclasses import dataclass, field

from .models import NodeSpec, SimRequest

INF = float("inf")

TYPE_DEFAULTS: dict[str, dict] = {
    "client":  {"capacity": INF,     "latency": 0,  "cost": 0},
    "dns":     {"capacity": 200_000, "latency": 1,  "cost": 10},
    "cdn":     {"capacity": 150_000, "latency": 6,  "cost": 250, "hit_rate": 0.6},
    "lb":      {"capacity": 25_000,  "latency": 1,  "cost": 25},
    "gateway": {"capacity": 8_000,   "latency": 3,  "cost": 60},
    "server":  {"capacity": 1_000,   "latency": 20, "cost": 70},
    "cache":   {"capacity": 60_000,  "latency": 1,  "cost": 120, "hit_rate": 0.85},
    "db":      {"capacity": 2_500,   "latency": 8,  "cost": 350},
    "nosql":   {"capacity": 10_000,  "latency": 4,  "cost": 280},
    "queue":   {"capacity": 50_000,  "latency": 2,  "cost": 90},
    "worker":  {"capacity": 600,     "latency": 25, "cost": 55},
    "storage": {"capacity": 8_000,   "latency": 35, "cost": 40},
    "search":  {"capacity": 2_000,   "latency": 20, "cost": 220},
}

WRITE_COST = {"db": 2.0, "nosql": 1.5, "search": 3.0, "storage": 1.0}
DATA_TYPES = {"db", "nosql", "storage", "search"}
SERVICE_TYPES = {"server", "worker", "gateway"}
SPLIT_HEALTHY = {"lb", "gateway", "dns"}  # nodes that health-check their targets
CONSUMER_TYPES = {"worker", "server"}
MAX_BACKLOG = 5_000_000
TIMEOUT_MS = 3_000
CLASSES = ("r", "w", "aw")  # read, sync write, async write (post-queue)


class SimulationError(ValueError):
    pass


@dataclass
class RNode:
    spec: NodeSpec
    type: str
    cap: float
    lat: float
    cost: float
    hit: float
    children: list[str] = field(default_factory=list)
    parents: list[str] = field(default_factory=list)
    eff_children: list[str] = field(default_factory=list)
    replicas: int = 1
    failed: int = 0
    pending: list[tuple[int, int]] = field(default_factory=list)
    cooldown: int = 0
    backlog: float = 0.0

    @property
    def id(self) -> str:
        return self.spec.id

    failed_at: int = -100

    @property
    def is_data(self) -> bool:
        return self.type in ("db", "nosql", "search")

    @property
    def instances(self) -> int:
        """Healthy instances per shard for data stores (primary + read replicas)."""
        return max(0, 1 + self.spec.read_replicas - self.failed)

    @property
    def healthy(self) -> int:
        if self.is_data:
            return self.instances
        return max(0, self.replicas - self.failed)

    @property
    def down(self) -> bool:
        return self.healthy == 0

    def total_capacity(self) -> float:
        if self.type == "client":
            return INF
        if self.is_data:
            return self.cap * self.spec.shards * self.instances
        return self.cap * self.healthy


@dataclass
class TickNodeState:
    util: float = 0.0
    drop: dict = field(default_factory=lambda: {"r": 0.0, "w": 0.0, "aw": 0.0})
    mean: dict = field(default_factory=lambda: {"r": 0.0, "w": 0.0, "aw": 0.0})
    load: float = 0.0
    dropped: float = 0.0


def _mm1(base: float, util: float) -> float:
    if base <= 0:
        return 0.0
    rho = min(util, 0.98)
    # pooled-queue approximation: gentler than M/M/1 at mid load, explodes near saturation
    return min(base * (1.0 + 0.5 * rho / (1.0 - rho)), TIMEOUT_MS)


def _drop(util: float) -> float:
    if util == INF:
        return 1.0
    return 0.0 if util <= 1.0 else 1.0 - 1.0 / util


def _percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    k = (len(sorted_vals) - 1) * p
    f, c = math.floor(k), math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)


class Simulator:
    def __init__(self, req: SimRequest):
        self.req = req
        self.traffic = req.traffic
        self.rng = random.Random(req.traffic.seed)
        self.nodes: dict[str, RNode] = {}
        self.virtual_edges: list[tuple[str, str]] = []
        self.tick = 0
        self._build()

    # ------------------------------------------------------------------ build
    def _build(self) -> None:
        if not self.req.nodes:
            raise SimulationError("Architecture is empty. Add at least a client and a server.")
        ids = set()
        for spec in self.req.nodes:
            if spec.id in ids:
                raise SimulationError(f"Duplicate node id '{spec.id}'.")
            ids.add(spec.id)
            d = TYPE_DEFAULTS[spec.type]
            self.nodes[spec.id] = RNode(
                spec=spec,
                type=spec.type,
                cap=spec.capacity if spec.capacity else d["capacity"],
                lat=spec.latency if spec.latency is not None else d["latency"],
                cost=d["cost"],
                hit=spec.hit_rate if spec.hit_rate is not None else d.get("hit_rate", 0.0),
                replicas=max(spec.replicas, spec.min_replicas) if spec.autoscale else spec.replicas,
            )
        for e in self.req.edges:
            if e.source not in self.nodes or e.target not in self.nodes:
                raise SimulationError(f"Edge {e.source} -> {e.target} references a missing node.")
            if e.source == e.target:
                raise SimulationError(f"Self-loop on '{e.source}' is not allowed.")
            if e.target not in self.nodes[e.source].children:
                self.nodes[e.source].children.append(e.target)
                self.nodes[e.target].parents.append(e.source)
        if not any(n.type == "client" for n in self.nodes.values()):
            raise SimulationError("Add a Client node: it is where traffic enters the system.")

        # effective children: cache-aside caches fall through to sibling data stores
        for n in self.nodes.values():
            n.eff_children = list(n.children)
        for n in self.nodes.values():
            if n.type != "cache":
                continue
            real_data = [c for c in n.children if self.nodes[c].type in DATA_TYPES | SERVICE_TYPES]
            if real_data:
                continue
            fallback: list[str] = []
            for p in n.parents:
                for sib in self.nodes[p].children:
                    if sib != n.id and self.nodes[sib].type in DATA_TYPES and sib not in fallback:
                        fallback.append(sib)
            for f in fallback:
                n.eff_children.append(f)
                self.virtual_edges.append((n.id, f))
        self.order = self._topo()

    def _topo(self) -> list[str]:
        indeg = {k: 0 for k in self.nodes}
        for n in self.nodes.values():
            for c in n.eff_children:
                indeg[c] += 1
        stack = [k for k, v in indeg.items() if v == 0]
        order = []
        while stack:
            k = stack.pop()
            order.append(k)
            for c in self.nodes[k].eff_children:
                indeg[c] -= 1
                if indeg[c] == 0:
                    stack.append(c)
        if len(order) != len(self.nodes):
            cyc = [k for k, v in indeg.items() if v > 0]
            raise SimulationError(
                "The request graph has a cycle (" + ", ".join(cyc[:6]) +
                "). Requests must flow one way: client -> edge -> services -> data.")
        return order

    # ---------------------------------------------------------------- traffic
    def rps_at(self, t: int) -> float:
        tr = self.traffic
        base = tr.rps
        if tr.pattern == "spike":
            s, e = tr.spike_at, tr.spike_at + tr.spike_duration
            if s <= t < e:
                ramp = min(1.0, (t - s + 1) / 6)
                base = tr.rps * (1 + (tr.spike_multiplier - 1) * ramp)
        elif tr.pattern == "ramp":
            base = tr.rps * (1 + (tr.spike_multiplier - 1) * t / max(1, tr.duration - 1))
        elif tr.pattern == "diurnal":
            phase = 0.5 * (1 - math.cos(2 * math.pi * t / tr.duration))
            base = tr.rps * (1 + (tr.spike_multiplier - 1) * phase)
        return max(0.0, base * (1 + self.rng.gauss(0, 0.02)))

    # ---------------------------------------------------------------- routing
    def _weights(self, n: RNode, targets: list[str], by_capacity: bool) -> list[tuple[str, float]]:
        if not targets:
            return []
        if n.type in SPLIT_HEALTHY:
            targets = [t for t in targets if not self.nodes[t].down]
            if not targets:
                return []
        if by_capacity:
            caps = [self.nodes[t].total_capacity() for t in targets]
            caps = [c if c != INF else 1e9 for c in caps]
            tot = sum(caps)
            if tot <= 0:
                return [(t, 1 / len(targets)) for t in targets]
            return [(t, c / tot) for t, c in zip(targets, caps)]
        return [(t, 1 / len(targets)) for t in targets]

    def _routes(self, n: RNode) -> dict[str, list[tuple[str, float]]]:
        kids = n.eff_children
        t = n.type
        if t in ("lb", "gateway"):
            # caches hanging off an edge node are side lookups (e.g. rate-limit counters), not routes
            routable = [c for c in kids if self.nodes[c].type != "cache"] or kids
            w = self._weights(n, routable, by_capacity=(t == "lb"))
            return {"r": w, "w": w, "aw": w}
        if t in ("client", "dns", "cdn"):
            w = self._weights(n, kids, by_capacity=False)
            return {"r": w, "w": w, "aw": w}
        if t == "cache":
            w = self._weights(n, kids, by_capacity=False)
            return {"r": w, "w": w, "aw": w}
        if t == "queue":
            cons = [c for c in kids if self.nodes[c].type in CONSUMER_TYPES] or kids
            w = self._weights(n, cons, by_capacity=True)
            return {"r": w, "w": w, "aw": w}
        if t in SERVICE_TYPES:
            caches = [c for c in kids if self.nodes[c].type == "cache"]
            healthy_caches = [c for c in caches if not self.nodes[c].down]
            queues = [c for c in kids if self.nodes[c].type == "queue"]
            downstream = [c for c in kids if self.nodes[c].type not in ("cache", "queue")]
            reads = healthy_caches or downstream
            writes = queues or downstream
            # async writes (coming out of a queue) never re-enqueue
            aw = downstream
            return {
                "r": self._weights(n, reads, False),
                "w": self._weights(n, writes, False),
                "aw": self._weights(n, aw, False),
            }
        return {"r": [], "w": [], "aw": []}  # data stores are terminal

    # ---------------------------------------------------------------- chaos
    def _apply_events(self, t: int) -> list[str]:
        events = []
        for n in self.nodes.values():
            s = n.spec
            if s.fail_at is not None and t == s.fail_at:
                full = (1 + s.read_replicas) if n.is_data else n.replicas
                n.failed = min(full, s.fail_replicas) if s.fail_replicas else full
                n.failed_at = t
                events.append(f"t={t}s {s.label or s.id} lost {n.failed} replica(s)")
            if s.recover_at is not None and t == s.recover_at and n.failed:
                n.failed = 0
                events.append(f"t={t}s {s.label or s.id} recovered")
            due = [p for p in n.pending if p[0] <= t]
            if due:
                target = due[-1][1]
                if target != n.replicas:
                    events.append(f"t={t}s autoscale {s.label or s.id}: {n.replicas} -> {target}")
                n.replicas = target
                n.pending = [p for p in n.pending if p[0] > t]
        for ch in self.req.chaos:
            victims = [n for n in self.nodes.values() if n.type == ch.node_type]
            if not victims:
                continue
            v = victims[0]
            if t == ch.at:
                full = (1 + v.spec.read_replicas) if v.is_data else v.replicas
                v.failed = min(full, ch.replicas) if ch.replicas else full
                v.failed_at = t
                events.append(f"t={t}s CHAOS: {v.spec.label or v.id} lost {v.failed} replica(s)")
            if ch.recover_at is not None and t == ch.recover_at:
                v.failed = 0
                events.append(f"t={t}s CHAOS: {v.spec.label or v.id} recovered")
        return events

    def _autoscale(self, t: int, states: dict[str, TickNodeState]) -> None:
        """Target-tracking autoscaler: aim for 55% utilisation, 3s instance boot time."""
        for n in self.nodes.values():
            s = n.spec
            if not s.autoscale or n.is_data or n.type == "client":
                continue
            u = states[n.id].util
            if u == INF:
                continue
            planned = max([n.replicas] + [p[1] for p in n.pending])
            if u > 0.7 and planned < s.max_replicas:
                desired = min(s.max_replicas, math.ceil(n.replicas * min(u, 6.0) / 0.55))
                if desired > planned:
                    n.pending.append((t + 3, desired))
            elif u < 0.25 and n.replicas > s.min_replicas and not n.pending and t >= n.cooldown:
                n.pending.append((t + 1, n.replicas - 1))
                n.cooldown = t + 3

    # ---------------------------------------------------------------- tick
    def _node_state(self, n: RNode, load: dict[str, float]) -> TickNodeState:
        st = TickNodeState()
        r, w, aw = load["r"], load["w"], load["aw"]
        writes = w + aw
        if n.type == "client":
            return st
        if n.is_data:
            if n.down:
                st.util = INF if (r + writes) > 0 else 0.0
                st.drop = {"r": 1.0, "w": 1.0, "aw": 1.0}
                st.mean = {"r": 0, "w": 0, "aw": 0}
                st.load = r + writes
                return st
            sh = n.spec.shards
            inst = n.instances
            wc = WRITE_COST.get(n.type, 1.0)
            per_inst_reads = r / sh / inst
            primary = (writes / sh * wc + per_inst_reads) / n.cap
            replica = (per_inst_reads + writes / sh * 0.3) / n.cap if inst > 1 else primary
            avg = (primary + replica * (inst - 1)) / inst
            st.util = max(primary, replica)
            st.drop = {"r": _drop(avg), "w": _drop(primary), "aw": _drop(primary)}
            if n.failed and self.tick - n.failed_at < 3:
                # primary lost: writes fail until a replica is promoted (~3s failover)
                st.drop["w"] = st.drop["aw"] = 1.0
            st.mean = {"r": _mm1(n.lat, avg), "w": _mm1(n.lat * wc, primary), "aw": _mm1(n.lat * wc, primary)}
            st.load = r + writes
            return st
        cap = n.total_capacity()
        total = r + w + aw
        if n.type == "queue":
            total = w + aw + r  # enqueue throughput
        util = (total / cap) if cap > 0 else (INF if total > 0 else 0.0)
        st.util = util
        d = _drop(util) if total > 0 or cap == 0 else 0.0
        if n.down:
            d = 1.0
        st.drop = {"r": d, "w": d, "aw": d}
        m = _mm1(n.lat, util if util != INF else 0.97)
        st.mean = {"r": m, "w": m, "aw": m}
        st.load = total
        return st

    def run(self) -> dict:
        tr = self.traffic
        timeline = []
        events_log: list[str] = []
        all_lat: list[float] = []
        read_lat: list[float] = []
        write_lat: list[float] = []
        node_acc = {k: {"util_sum": 0.0, "util_peak": 0.0, "dropped": 0.0, "lat_sum": 0.0, "replica_sum": 0.0}
                    for k in self.nodes}
        tot_in = tot_err = tot_async_err = 0.0
        clients = [k for k, n in self.nodes.items() if n.type == "client"]

        for t in range(tr.duration):
            self.tick = t
            events_log += self._apply_events(t)
            rps = self.rps_at(t)
            inflow = {k: {"r": 0.0, "w": 0.0, "aw": 0.0} for k in self.nodes}
            for c in clients:
                inflow[c]["r"] += rps * tr.read_ratio / len(clients)
                inflow[c]["w"] += rps * (1 - tr.read_ratio) / len(clients)

            states: dict[str, TickNodeState] = {}
            routes: dict[str, dict] = {}
            err = async_err = 0.0
            for k in self.order:
                n = self.nodes[k]
                load = inflow[k]
                st = self._node_state(n, load)
                states[k] = st
                rt = self._routes(n)
                routes[k] = rt
                out = {}
                for cls in CLASSES:
                    amt = load[cls]
                    if amt <= 0:
                        out[cls] = 0.0
                        continue
                    dropped = amt * st.drop[cls]
                    passed = amt - dropped
                    if n.type == "cache":
                        # overloaded cache -> fall through to origin, not an error
                        served = passed * n.hit if cls == "r" else 0.0
                        out[cls] = amt - served
                        dropped = 0.0
                    elif n.type == "cdn" and cls == "r":
                        out[cls] = passed * (1 - n.hit)
                    elif n.type == "queue" and cls in ("w", "aw"):
                        out[cls] = 0.0
                        n.backlog += passed
                    else:
                        out[cls] = passed
                    st.dropped += dropped
                    if cls == "aw":
                        async_err += dropped
                    else:
                        err += dropped
                # queue drain
                if n.type == "queue":
                    consumer_cap = sum(self.nodes[c].total_capacity() for c, _ in rt["aw"]) if rt["aw"] else 0.0
                    drain = min(n.backlog, consumer_cap)
                    n.backlog -= drain
                    if n.backlog > MAX_BACKLOG:
                        async_err += n.backlog - MAX_BACKLOG
                        n.backlog = MAX_BACKLOG
                    for c, wgt in rt["aw"]:
                        inflow[c]["aw"] += drain * wgt
                # forward
                for cls in CLASSES:
                    if out.get(cls, 0) <= 0:
                        continue
                    cls_out = "aw" if (n.type == "queue" and cls != "r") else cls
                    targets = rt[cls]
                    if not targets:
                        if n.type in ("lb", "gateway", "dns") and n.eff_children:
                            # every backend is down: nothing can serve
                            if cls == "aw":
                                async_err += out[cls]
                            else:
                                err += out[cls]
                            st.dropped += out[cls]
                        continue  # served here
                    for c, wgt in targets:
                        inflow[c][cls_out] += out[cls] * wgt

            # sampling for latency
            lat_r, lat_w = self._sample(states, routes, tr.read_ratio)
            tick_all = sorted(lat_r + lat_w)
            all_lat += tick_all
            read_lat += lat_r
            write_lat += lat_w

            self._autoscale(t, states)
            tot_in += rps
            tot_err += err
            tot_async_err += async_err
            util_snapshot = {}
            for k, st in states.items():
                u = st.util if st.util != INF else 999.0
                util_snapshot[k] = round(u, 3)
                acc = node_acc[k]
                acc["util_sum"] += u
                acc["util_peak"] = max(acc["util_peak"], u)
                acc["dropped"] += st.dropped
                acc["lat_sum"] += st.mean["r"]
                acc["replica_sum"] += self.nodes[k].replicas
            timeline.append({
                "t": t,
                "rps": round(rps, 1),
                "success": round(max(0.0, rps - err), 1),
                "errors": round(err, 1),
                "async_errors": round(async_err, 1),
                "error_rate": round(err / rps, 4) if rps else 0,
                "p50": round(_percentile(tick_all, 0.5), 1),
                "p95": round(_percentile(tick_all, 0.95), 1),
                "p99": round(_percentile(tick_all, 0.99), 1),
                "backlog": round(sum(n.backlog for n in self.nodes.values() if n.type == "queue")),
                "util": util_snapshot,
                "replicas": {k: n.healthy for k, n in self.nodes.items()},
                "down": [k for k, n in self.nodes.items() if n.down and n.type != "client"],
            })

        return self._summary(timeline, events_log, all_lat, read_lat, write_lat, node_acc,
                             tot_in, tot_err, tot_async_err)

    # ---------------------------------------------------------------- sampling
    def _sample(self, states, routes, read_ratio) -> tuple[list[float], list[float]]:
        rng = self.rng
        clients = [k for k, n in self.nodes.items() if n.type == "client"]
        lat_r: list[float] = []
        lat_w: list[float] = []
        k_samples = self.req.samples_per_tick
        for _ in range(k_samples):
            cls = "r" if rng.random() < read_ratio else "w"
            start = clients[rng.randrange(len(clients))]
            res = self._walk(start, cls, states, routes, 0, None)
            if res is not None:
                (lat_r if cls == "r" else lat_w).append(res)
        return lat_r, lat_w

    def _hop(self, parent: str | None, child: RNode) -> float:
        if parent is None:
            return 0.0
        if self.nodes[parent].type == "client":
            return 8.0 if child.type in ("cdn", "dns") else 40.0
        return 0.5

    def _pick(self, opts: list[tuple[str, float]]) -> str:
        x = self.rng.random()
        acc = 0.0
        for c, w in opts:
            acc += w
            if x <= acc:
                return c
        return opts[-1][0]

    def _service(self, mean: float, base: float) -> float:
        if mean <= 0:
            return 0.0
        fixed = min(base * 0.5, mean)
        var = mean - fixed
        return fixed + (self.rng.expovariate(1 / var) if var > 0 else 0.0)

    def _walk(self, nid: str, cls: str, states, routes, depth: int, parent: str | None):
        if depth > 40:
            return None
        n = self.nodes[nid]
        st = states[nid]
        lat = self._hop(parent, n)
        if n.type == "cache":
            if self.rng.random() >= st.drop[cls] and cls == "r" and self.rng.random() < n.hit:
                return lat + self._service(st.mean[cls], n.lat)
            lat += n.lat  # miss (or overloaded): pay the lookup, fall through
            opts = routes[nid][cls]
            if not opts:
                return lat
            sub = self._walk(self._pick(opts), cls, states, routes, depth + 1, nid)
            return None if sub is None else lat + sub
        if self.rng.random() < st.drop[cls]:
            return None
        lat += self._service(st.mean[cls], n.lat)
        if n.type == "cdn" and cls == "r" and self.rng.random() < n.hit:
            return lat
        if n.type == "queue" and cls == "w":
            return lat  # acknowledged, processed asynchronously
        opts = routes[nid][cls]
        if not opts:
            if n.type in ("lb", "gateway", "dns") and n.eff_children:
                return None
            return lat
        sub = self._walk(self._pick(opts), cls, states, routes, depth + 1, nid)
        return None if sub is None else lat + sub

    # ---------------------------------------------------------------- summary
    def _summary(self, timeline, events_log, all_lat, read_lat, write_lat, node_acc,
                 tot_in, tot_err, tot_async_err) -> dict:
        dur = self.traffic.duration
        all_lat.sort()
        read_lat.sort()
        write_lat.sort()
        node_stats = {}
        cost = 0.0
        for k, n in self.nodes.items():
            acc = node_acc[k]
            avg_rep = acc["replica_sum"] / dur
            if n.type in ("db", "nosql", "search"):
                inst = n.spec.shards * (1 + n.spec.read_replicas) * max(1, n.replicas)
                node_cost = inst * n.cost
            else:
                node_cost = avg_rep * n.cost
            cost += node_cost
            node_stats[k] = {
                "label": n.spec.label or k,
                "type": n.type,
                "avg_util": round(acc["util_sum"] / dur, 3),
                "peak_util": round(acc["util_peak"], 3),
                "dropped": round(acc["dropped"]),
                "avg_latency": round(acc["lat_sum"] / dur, 1),
                "avg_replicas": round(avg_rep, 1),
                "monthly_cost": round(node_cost),
            }
        candidates = [(k, s["peak_util"]) for k, s in node_stats.items() if self.nodes[k].type != "client"]
        bottleneck = max(candidates, key=lambda x: x[1])[0] if candidates else None
        err_rate = tot_err / tot_in if tot_in else 0.0
        final_backlog = timeline[-1]["backlog"] if timeline else 0
        return {
            "summary": {
                "total_requests": round(tot_in),
                "peak_rps": max(x["rps"] for x in timeline),
                "avg_rps": round(tot_in / dur, 1),
                "error_rate": round(err_rate, 5),
                "availability": round(100 * (1 - err_rate), 3),
                "async_failures": round(tot_async_err),
                "p50": round(_percentile(all_lat, 0.5), 1),
                "p95": round(_percentile(all_lat, 0.95), 1),
                "p99": round(_percentile(all_lat, 0.99), 1),
                "read_p99": round(_percentile(read_lat, 0.99), 1),
                "write_p99": round(_percentile(write_lat, 0.99), 1),
                "monthly_cost": round(cost),
                "bottleneck": bottleneck,
                "final_backlog": final_backlog,
                "peak_backlog": max(x["backlog"] for x in timeline),
            },
            "nodes": node_stats,
            "timeline": timeline,
            "events": events_log,
            "virtual_edges": [{"source": a, "target": b} for a, b in self.virtual_edges],
        }


def simulate(req: SimRequest) -> dict:
    return Simulator(req).run()
