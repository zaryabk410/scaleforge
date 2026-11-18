import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ["SCALEFORGE_DB"] = "/tmp/scaleforge_test.db"

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.practice.drills import INTERVIEWS
from app.practice.quizzes import QUESTIONS
from app.sim.scenarios import SCENARIOS, grade
from solutions import SOLUTIONS


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.mark.parametrize("sid", [s["id"] for s in SCENARIOS])
def test_every_scenario_has_passing_solution(sid):
    nodes, edges = SOLUTIONS[sid]
    g = grade(sid, nodes, edges)
    assert g["passed"], [c for c in g["checks"] if not c["passed"]]


@pytest.mark.parametrize("sid", [s["id"] for s in SCENARIOS])
def test_starter_fails(sid):
    s = next(x for x in SCENARIOS if x["id"] == sid)
    g = grade(sid, s["starter"]["nodes"], s["starter"]["edges"])
    assert not g["passed"]


def test_sim_run_and_findings(client):
    body = {"nodes": [{"id": "c", "type": "client"}, {"id": "s", "type": "server"}, {"id": "d", "type": "db"}],
            "edges": [{"source": "c", "target": "s"}, {"source": "s", "target": "d"}],
            "traffic": {"rps": 3000, "duration": 20}}
    r = client.post("/api/sim/run", json=body)
    assert r.status_code == 200
    j = r.json()
    assert j["summary"]["error_rate"] > 0.3
    codes = {f["code"] for f in j["findings"]}
    assert {"SPOF", "OVERLOAD", "NO_LB"} <= codes
    assert len(j["timeline"]) == 20


def test_cycle_rejected(client):
    body = {"nodes": [{"id": "c", "type": "client"}, {"id": "a", "type": "server"}, {"id": "b", "type": "server"}],
            "edges": [{"source": "c", "target": "a"}, {"source": "a", "target": "b"}, {"source": "b", "target": "a"}]}
    r = client.post("/api/sim/run", json=body)
    assert r.status_code == 400 and "cycle" in r.json()["detail"]


def test_queue_drains_and_acks_fast(client):
    body = {"nodes": [{"id": "c", "type": "client"}, {"id": "lb", "type": "lb"}, {"id": "s", "type": "server", "replicas": 10},
                      {"id": "q", "type": "queue"}, {"id": "w", "type": "worker", "replicas": 2}, {"id": "d", "type": "nosql"}],
            "edges": [{"source": "c", "target": "lb"}, {"source": "lb", "target": "s"}, {"source": "s", "target": "q"},
                      {"source": "q", "target": "w"}, {"source": "w", "target": "d"}, {"source": "s", "target": "d"}],
            "traffic": {"rps": 5000, "read_ratio": 0.5, "duration": 30}}
    j = client.post("/api/sim/run", json=body).json()
    assert j["summary"]["final_backlog"] > 10000  # 2 workers cannot keep up
    assert "BACKLOG" in {f["code"] for f in j["findings"]}


def test_lb_routes_around_dead_group(client):
    body = {"nodes": [{"id": "c", "type": "client"}, {"id": "lb", "type": "lb", "replicas": 2},
                      {"id": "a", "type": "server", "replicas": 4, "fail_at": 5}, {"id": "b", "type": "server", "replicas": 4},
                      {"id": "d", "type": "nosql", "read_replicas": 1}],
            "edges": [{"source": "c", "target": "lb"}, {"source": "lb", "target": "a"}, {"source": "lb", "target": "b"},
                      {"source": "a", "target": "d"}, {"source": "b", "target": "d"}],
            "traffic": {"rps": 2000, "duration": 20}}
    j = client.post("/api/sim/run", json=body).json()
    assert j["summary"]["error_rate"] < 0.01
    assert any("lost" in e for e in j["events"])


def test_labs(client):
    ch = client.post("/api/labs/consistent-hashing", json={"nodes": ["A", "B", "C", "D"], "vnodes": 100, "add": "E"}).json()
    assert ch["moved_pct"] < 35 and ch["modulo_moved_pct"] > 60
    sh = client.post("/api/labs/sharding", json={"strategy": "range", "key_pattern": "sequential", "access_skew": 1.0}).json()
    assert sh["hotspot_factor"] > 2.5
    rl = client.post("/api/labs/rate-limiter", json={"pattern": "boundary", "rate": 20, "limit": 10, "window": 1}).json()
    assert rl["algorithms"]["fixed_window"]["overshoot"] > 0
    assert rl["algorithms"]["sliding_log"]["overshoot"] == 0
    raft = client.post("/api/labs/raft", json={}).json()
    assert raft["stats"]["leaders"] and raft["frames"]
    terms = {}
    for l in raft["stats"]["leaders"]:
        assert l["term"] not in terms, "two leaders in one term"
        terms[l["term"]] = l["id"]
    cache = client.post("/api/labs/cache", json={"capacity": 50, "scan": True}).json()
    p = cache["policies"]
    assert p["optimal"]["hit_rate"] >= max(v["hit_rate"] for k, v in p.items() if k != "optimal")
    q = client.post("/api/labs/quorum", json={"n": 3, "r": 2, "w": 2}).json()
    assert q["strong_quorum"] and q["stale_read_pct"] == 0
    q2 = client.post("/api/labs/quorum", json={"n": 3, "r": 1, "w": 1, "replication_ms": 50}).json()
    assert q2["stale_read_pct"] > 0


def test_raft_committed_logs_agree(client):
    raft = client.post("/api/labs/raft", json={"duration": 6000, "seed": 9}).json()
    finals = [n for n in raft["final"] if n["state"] != "dead"]
    min_commit = min(n["commit"] for n in finals)
    prefixes = {tuple(n["log"][:min_commit]) for n in finals}
    assert len(prefixes) == 1, "committed prefixes diverged"


def test_practice_flow(client):
    qs = client.get("/api/practice/quiz", params={"topic": "caching"}).json()
    assert qs and "answer" not in qs[0]
    answers = {q["id"]: QUESTIONS[q["id"]]["answer"] for q in qs}
    g = client.post("/api/practice/quiz/grade", json={"answers": answers, "uid": "tester", "topic": "caching"}).json()
    assert g["score"] == 100
    e = client.post("/api/practice/estimations/tweets-qps/check", json={"value": 7000, "uid": "tester"}).json()
    assert e["correct"]
    iv = INTERVIEWS[0]
    s = client.post(f"/api/practice/interviews/{iv['id']}/self-assess",
                    json={"checked": list(range(len(iv["rubric"]))), "uid": "tester"}).json()
    assert s["score"] == 100
    prog = client.get("/api/progress/tester").json()
    assert prog["totals"]["estimations"]["done"] >= 1


@pytest.mark.parametrize("iid", [i["id"] for i in INTERVIEWS])
def test_interview_reference_graphs_simulate(client, iid):
    i = client.get(f"/api/practice/interviews/{iid}").json()
    body = {"nodes": i["reference"]["nodes"], "edges": i["reference"]["edges"], "traffic": i["traffic"]}
    r = client.post("/api/sim/run", json=body)
    assert r.status_code == 200, r.text
    assert r.json()["summary"]["error_rate"] < 0.05, (iid, r.json()["summary"])


def test_designs(client):
    client.post("/api/designs", json={"uid": "tester", "name": "v1", "graph": {"nodes": [], "edges": []}})
    assert client.get("/api/designs/tester").json()[0]["name"] == "v1"
