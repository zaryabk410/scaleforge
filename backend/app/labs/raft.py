"""A compact, faithful Raft simulation (leader election + log replication).

Discrete time in milliseconds. Supports node crashes/restarts, network
partitions and client writes, and records frames for animation.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

HEARTBEAT_MS = 50


@dataclass
class Msg:
    deliver_at: int
    sent_at: int
    src: str
    dst: str
    kind: str
    data: dict


@dataclass
class RaftNode:
    id: str
    state: str = "follower"
    term: int = 0
    voted_for: str | None = None
    log: list[dict] = field(default_factory=list)  # {"term", "cmd"}
    commit: int = 0  # number of committed entries
    alive: bool = True
    deadline: int = 0
    votes: set = field(default_factory=set)
    next_index: dict = field(default_factory=dict)
    match_index: dict = field(default_factory=dict)
    last_hb: int = -10_000

    def last_index(self) -> int:
        return len(self.log)

    def last_term(self) -> int:
        return self.log[-1]["term"] if self.log else 0


class RaftSim:
    def __init__(self, n: int, duration: int, latency: tuple[int, int], events: list[dict],
                 client_interval: int, seed: int):
        self.rng = random.Random(seed)
        self.ids = [f"N{i + 1}" for i in range(n)]
        self.nodes = {i: RaftNode(i) for i in self.ids}
        self.duration = duration
        self.lat = latency
        self.events = sorted(events, key=lambda e: e["at"])
        self.client_interval = client_interval
        self.msgs: list[Msg] = []
        self.groups: list[set] | None = None
        self.log: list[dict] = []
        self.frames: list[dict] = []
        self.t = 0
        self.cmd_seq = 0
        self.stats = {"elections": 0, "leaders": [], "messages": 0, "committed": 0}
        for node in self.nodes.values():
            self._reset_timer(node)

    # helpers
    def _note(self, msg: str, kind: str = "info"):
        self.log.append({"t": self.t, "msg": msg, "kind": kind})

    def _reset_timer(self, node: RaftNode):
        node.deadline = self.t + self.rng.randint(150, 300)

    def _connected(self, a: str, b: str) -> bool:
        if self.groups is None:
            return True
        return any(a in g and b in g for g in self.groups)

    def _send(self, src: str, dst: str, kind: str, data: dict):
        self.stats["messages"] += 1
        delay = self.rng.randint(*self.lat)
        self.msgs.append(Msg(self.t + delay, self.t, src, dst, kind, data))

    def _majority(self) -> int:
        return len(self.ids) // 2 + 1

    def _step_down(self, node: RaftNode, term: int):
        if term > node.term:
            node.term = term
            node.voted_for = None
        if node.state != "follower":
            self._note(f"{node.id} steps down to follower (term {node.term})")
        node.state = "follower"
        node.votes = set()

    # election
    def _start_election(self, node: RaftNode):
        node.state = "candidate"
        node.term += 1
        node.voted_for = node.id
        node.votes = {node.id}
        self.stats["elections"] += 1
        self._reset_timer(node)
        self._note(f"{node.id} timed out -> candidate for term {node.term}", "election")
        for p in self.ids:
            if p != node.id:
                self._send(node.id, p, "RequestVote",
                           {"term": node.term, "lli": node.last_index(), "llt": node.last_term()})
        if len(node.votes) >= self._majority():
            self._become_leader(node)

    def _become_leader(self, node: RaftNode):
        node.state = "leader"
        self.stats["leaders"].append({"t": self.t, "id": node.id, "term": node.term})
        self._note(f"{node.id} becomes LEADER for term {node.term} ({len(node.votes)} votes)", "leader")
        for p in self.ids:
            node.next_index[p] = node.last_index() + 1
            node.match_index[p] = 0
        node.match_index[node.id] = node.last_index()
        self._heartbeat(node)

    def _heartbeat(self, leader: RaftNode):
        leader.last_hb = self.t
        for p in self.ids:
            if p == leader.id:
                continue
            ni = leader.next_index.get(p, leader.last_index() + 1)
            prev = ni - 1
            prev_term = leader.log[prev - 1]["term"] if prev >= 1 else 0
            entries = leader.log[prev:prev + 8]
            self._send(leader.id, p, "AppendEntries", {
                "term": leader.term, "prev": prev, "prev_term": prev_term,
                "entries": entries, "commit": leader.commit})

    # message handling
    def _handle(self, m: Msg):
        node = self.nodes[m.dst]
        d = m.data
        if d["term"] > node.term:
            self._step_down(node, d["term"])
        if m.kind == "RequestVote":
            up_to_date = (d["llt"], d["lli"]) >= (node.last_term(), node.last_index())
            grant = d["term"] == node.term and node.voted_for in (None, m.src) and up_to_date
            if grant:
                node.voted_for = m.src
                self._reset_timer(node)
            self._send(node.id, m.src, "Vote", {"term": node.term, "granted": grant})
        elif m.kind == "Vote":
            if node.state == "candidate" and d["term"] == node.term and d["granted"]:
                node.votes.add(m.src)
                if len(node.votes) >= self._majority():
                    self._become_leader(node)
        elif m.kind == "AppendEntries":
            if d["term"] < node.term:
                self._send(node.id, m.src, "AppendResp", {"term": node.term, "ok": False, "match": 0})
                return
            if node.state != "follower":
                self._step_down(node, d["term"])
            self._reset_timer(node)
            prev = d["prev"]
            if prev > node.last_index() or (prev >= 1 and node.log[prev - 1]["term"] != d["prev_term"]):
                self._send(node.id, m.src, "AppendResp", {"term": node.term, "ok": False, "match": 0, "hint": min(prev, node.last_index())})
                return
            idx = prev
            for e in d["entries"]:
                idx += 1
                if idx <= node.last_index():
                    if node.log[idx - 1]["term"] != e["term"]:
                        dropped = node.last_index() - idx + 1
                        node.log = node.log[:idx - 1]
                        self._note(f"{node.id} truncates {dropped} conflicting entr{'y' if dropped == 1 else 'ies'}", "warn")
                        node.log.append(dict(e))
                else:
                    node.log.append(dict(e))
            match = prev + len(d["entries"])
            if d["commit"] > node.commit:
                node.commit = min(d["commit"], node.last_index())
            self._send(node.id, m.src, "AppendResp", {"term": node.term, "ok": True, "match": match})
        elif m.kind == "AppendResp":
            if node.state != "leader" or d["term"] != node.term:
                return
            if d["ok"]:
                node.match_index[m.src] = max(node.match_index.get(m.src, 0), d["match"])
                node.next_index[m.src] = node.match_index[m.src] + 1
                self._advance_commit(node)
            else:
                node.next_index[m.src] = max(1, min(node.next_index.get(m.src, 1) - 1, d.get("hint", 0) + 1))

    def _advance_commit(self, leader: RaftNode):
        for n in range(leader.last_index(), leader.commit, -1):
            replicated = sum(1 for p in self.ids if leader.match_index.get(p, 0) >= n)
            # only entries from the current term are committed by counting (Raft §5.4.2)
            if replicated >= self._majority() and leader.log[n - 1]["term"] == leader.term:
                newly = n - leader.commit
                leader.commit = n
                self.stats["committed"] = max(self.stats["committed"], n)
                self._note(f"{leader.id} commits up to index {n} (+{newly}) on {replicated}/{len(self.ids)} nodes", "commit")
                break

    # events
    def _apply_event(self, e: dict):
        typ = e["type"]
        if typ == "kill":
            target = e.get("node") or self._leader_id()
            if target and self.nodes[target].alive:
                self.nodes[target].alive = False
                self._note(f"{target} CRASHED", "fault")
        elif typ == "revive":
            node = self.nodes.get(e.get("node", ""))
            if node and not node.alive:
                node.alive = True
                node.state = "follower"
                node.votes = set()
                self._reset_timer(node)
                self._note(f"{node.id} restarted (term {node.term}, log {node.last_index()})", "fault")
        elif typ == "partition":
            groups = e.get("groups")
            if not groups:
                half = len(self.ids) // 2
                leader = self._leader_id()
                minority = [leader] if leader else self.ids[:1]
                for i in self.ids:
                    if len(minority) >= max(1, half) or i in minority:
                        continue
                    minority.append(i)
                groups = [minority, [i for i in self.ids if i not in minority]]
            self.groups = [set(g) for g in groups]
            self._note("NETWORK PARTITION: " + " | ".join("{" + ",".join(sorted(g)) + "}" for g in groups), "fault")
        elif typ == "heal":
            self.groups = None
            self._note("Network healed", "fault")
        elif typ == "client":
            self._client_write(e.get("count", 1))

    def _leader_id(self) -> str | None:
        leaders = [n for n in self.nodes.values() if n.alive and n.state == "leader"]
        if not leaders:
            return None
        return max(leaders, key=lambda n: n.term).id

    def _client_write(self, count: int = 1):
        leaders = [n for n in self.nodes.values() if n.alive and n.state == "leader"]
        if not leaders:
            self._note("client write rejected: no leader", "warn")
            return
        for leader in leaders:  # a stale leader in a minority partition also accepts (and never commits)
            for _ in range(count):
                self.cmd_seq += 1
                leader.log.append({"term": leader.term, "cmd": f"SET x={self.cmd_seq}"})
            leader.match_index[leader.id] = leader.last_index()
            self._note(f"client -> {leader.id}: append index {leader.last_index()} (term {leader.term})", "client")

    def run(self) -> dict:
        ev_i = 0
        next_client = self.client_interval if self.client_interval else None
        for self.t in range(0, self.duration + 1, 5):
            while ev_i < len(self.events) and self.events[ev_i]["at"] <= self.t:
                self._apply_event(self.events[ev_i])
                ev_i += 1
            if next_client is not None and self.t >= next_client:
                self._client_write()
                next_client += self.client_interval
            due = [m for m in self.msgs if m.deliver_at <= self.t]
            self.msgs = [m for m in self.msgs if m.deliver_at > self.t]
            for m in due:
                if self.nodes[m.dst].alive and self.nodes[m.src].alive and self._connected(m.src, m.dst):
                    self._handle(m)
            for node in self.nodes.values():
                if not node.alive:
                    continue
                if node.state == "leader":
                    if self.t - node.last_hb >= HEARTBEAT_MS:
                        self._heartbeat(node)
                elif self.t >= node.deadline:
                    self._start_election(node)
            if self.t % 20 == 0:
                self._frame()
        return {
            "nodes": self.ids,
            "frames": self.frames,
            "log": self.log,
            "stats": self.stats,
            "final": [self._node_view(n) for n in self.nodes.values()],
        }

    def _node_view(self, n: RaftNode) -> dict:
        return {
            "id": n.id, "state": n.state if n.alive else "dead", "term": n.term,
            "voted_for": n.voted_for, "log": [e["term"] for e in n.log],
            "commit": n.commit, "timeout": max(0, n.deadline - self.t) if n.state != "leader" else 0,
        }

    def _frame(self):
        msgs = []
        for m in self.msgs:
            if m.kind == "AppendEntries" and not m.data["entries"] and len(msgs) > 40:
                continue
            span = max(1, m.deliver_at - m.sent_at)
            msgs.append({"from": m.src, "to": m.dst, "kind": m.kind,
                         "p": round((self.t - m.sent_at) / span, 2),
                         "blocked": not self._connected(m.src, m.dst)})
        self.frames.append({
            "t": self.t,
            "nodes": [self._node_view(n) for n in self.nodes.values()],
            "msgs": msgs[:60],
            "partition": [sorted(g) for g in self.groups] if self.groups else None,
        })


def raft_lab(n: int = 5, duration: int = 4000, latency_min: int = 5, latency_max: int = 25,
             events: list[dict] | None = None, client_interval: int = 300, seed: int = 3) -> dict:
    if events is None:
        events = [{"at": 1200, "type": "kill"}, {"at": 2200, "type": "revive", "node": "N1"},
                  {"at": 2600, "type": "partition"}, {"at": 3400, "type": "heal"}]
    return RaftSim(n, duration, (latency_min, latency_max), events, client_interval, seed).run()
