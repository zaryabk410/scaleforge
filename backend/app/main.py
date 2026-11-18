"""ScaleForge API: simulator, algorithm labs, practice and progress."""

import json
import os
import sys
from typing import Literal, Optional

# Vercel loads this file directly (not as package "app"), so make the package importable
# and use absolute imports. Works the same under `uvicorn app.main:app`.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import db
from app.labs.cache import cache_lab
from app.labs.hashing import consistent_hash_lab, estimate_shards, sharding_lab
from app.labs.quorum import quorum_lab
from app.labs.raft import raft_lab
from app.labs.ratelimit import rate_limit_lab
from app.practice.drills import E_MAP, ESTIMATIONS, I_MAP, INTERVIEWS
from app.practice.quizzes import QUESTIONS, TOPICS
from app.sim.analyzer import review
from app.sim.engine import TYPE_DEFAULTS, SimulationError, simulate
from app.sim.models import SimRequest
from app.sim.scenarios import SCENARIO_MAP, SCENARIOS, grade

app = FastAPI(title="ScaleForge API", version="1.0.0",
              description="System design simulator, algorithm labs and practice engine.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def _startup() -> None:
    db.init()


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ------------------------------------------------------------------ simulator
@app.get("/api/sim/components")
def components():
    return {k: {kk: (None if vv == float("inf") else vv) for kk, vv in v.items()} for k, v in TYPE_DEFAULTS.items()}


@app.post("/api/sim/run")
def run_sim(req: SimRequest):
    try:
        result = simulate(req)
        result["findings"] = review(req, result)
        return result
    except SimulationError as e:
        raise HTTPException(400, str(e))


@app.post("/api/sim/review")
def review_only(req: SimRequest):
    try:
        return {"findings": review(req)}
    except SimulationError as e:
        raise HTTPException(400, str(e))


@app.get("/api/scenarios")
def scenarios():
    return SCENARIOS


@app.get("/api/scenarios/{sid}")
def scenario(sid: str):
    if sid not in SCENARIO_MAP:
        raise HTTPException(404, "scenario not found")
    return SCENARIO_MAP[sid]


class GradeRequest(BaseModel):
    nodes: list[dict]
    edges: list[dict]
    uid: Optional[str] = None


@app.post("/api/scenarios/{sid}/grade")
def grade_scenario(sid: str, body: GradeRequest):
    if sid not in SCENARIO_MAP:
        raise HTTPException(404, "scenario not found")
    try:
        g = grade(sid, body.nodes, body.edges)
    except SimulationError as e:
        raise HTTPException(400, str(e))
    except Exception as e:  # pydantic validation of node specs
        raise HTTPException(400, f"Invalid architecture: {e}")
    db.record(body.uid, "scenario", sid, g["score"], 100, g["passed"])
    return g


# ------------------------------------------------------------------ labs
class HashReq(BaseModel):
    nodes: list[str] = Field(default_factory=lambda: ["A", "B", "C", "D"])
    vnodes: int = Field(16, ge=1, le=512)
    num_keys: int = Field(5000, ge=10, le=100_000)
    add: Optional[str] = None
    remove: Optional[str] = None


@app.post("/api/labs/consistent-hashing")
def lab_ch(r: HashReq):
    try:
        return consistent_hash_lab(r.nodes, r.vnodes, r.num_keys, r.add, r.remove)
    except ValueError as e:
        raise HTTPException(400, str(e))


class ShardReq(BaseModel):
    strategy: Literal["hash", "range", "consistent", "directory"] = "hash"
    shards: int = Field(4, ge=2, le=32)
    num_keys: int = Field(5000, ge=100, le=50_000)
    key_pattern: Literal["uniform", "sequential", "skewed"] = "uniform"
    access_skew: float = Field(0.8, ge=0, le=2)


@app.post("/api/labs/sharding")
def lab_shard(r: ShardReq):
    return sharding_lab(r.strategy, r.shards, r.num_keys, r.key_pattern, r.access_skew)


class ShardEst(BaseModel):
    write_qps: float = 10000
    read_qps: float = 50000
    storage_tb: float = 10


@app.post("/api/labs/shard-estimate")
def lab_shard_est(r: ShardEst):
    return estimate_shards(r.write_qps, r.read_qps, r.storage_tb)


class RLReq(BaseModel):
    pattern: Literal["steady", "burst", "poisson", "boundary"] = "burst"
    rate: float = Field(20, gt=0, le=500)
    duration: float = Field(10, ge=2, le=60)
    limit: int = Field(10, ge=1, le=1000)
    window: float = Field(1.0, gt=0, le=60)
    burst: int = Field(10, ge=1, le=1000)
    algorithms: Optional[list[Literal["token_bucket", "leaky_bucket", "fixed_window", "sliding_log", "sliding_counter"]]] = None


@app.post("/api/labs/rate-limiter")
def lab_rl(r: RLReq):
    return rate_limit_lab(r.pattern, r.rate, r.duration, r.limit, r.window, r.burst, r.algorithms)


class RaftEvent(BaseModel):
    at: int = Field(ge=0)
    type: Literal["kill", "revive", "partition", "heal", "client"]
    node: Optional[str] = None
    groups: Optional[list[list[str]]] = None
    count: int = 1


class RaftReq(BaseModel):
    n: int = Field(5, ge=3, le=9)
    duration: int = Field(4000, ge=500, le=12000)
    latency_min: int = Field(5, ge=1, le=200)
    latency_max: int = Field(25, ge=1, le=400)
    client_interval: int = Field(300, ge=0, le=5000)
    events: Optional[list[RaftEvent]] = None
    seed: int = 3


@app.post("/api/labs/raft")
def lab_raft(r: RaftReq):
    if r.latency_max < r.latency_min:
        raise HTTPException(400, "latency_max must be >= latency_min")
    ev = [e.model_dump() for e in r.events] if r.events is not None else None
    return raft_lab(r.n, r.duration, r.latency_min, r.latency_max, ev, r.client_interval, r.seed)


class CacheReq(BaseModel):
    capacity: int = Field(50, ge=1, le=5000)
    num_keys: int = Field(1000, ge=10, le=100_000)
    length: int = Field(20000, ge=100, le=200_000)
    alpha: float = Field(0.9, ge=0, le=2.5)
    scan: bool = False
    policies: Optional[list[Literal["lru", "lfu", "fifo", "random", "tinylfu"]]] = None


@app.post("/api/labs/cache")
def lab_cache(r: CacheReq):
    return cache_lab(r.capacity, r.num_keys, r.length, r.alpha, r.scan, r.policies)


class QuorumReq(BaseModel):
    n: int = Field(3, ge=1, le=9)
    r: int = Field(2, ge=1, le=9)
    w: int = Field(2, ge=1, le=9)
    failed: int = Field(0, ge=0, le=8)
    replication_ms: float = Field(20, gt=0, le=2000)
    read_delay_ms: float = Field(0, ge=0, le=5000)


@app.post("/api/labs/quorum")
def lab_quorum(q: QuorumReq):
    try:
        return quorum_lab(q.n, q.r, q.w, q.failed, q.replication_ms, q.read_delay_ms)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ------------------------------------------------------------------ practice
@app.get("/api/practice/topics")
def quiz_topics():
    counts = {t: sum(1 for q in QUESTIONS.values() if q["topic"] == t) for t in TOPICS}
    return [{"topic": t, "count": c} for t, c in counts.items()]


@app.get("/api/practice/quiz")
def quiz(topic: Optional[str] = None, limit: int = 10, difficulty: Optional[str] = None):
    qs = [q for q in QUESTIONS.values() if (not topic or q["topic"] == topic)
          and (not difficulty or q["difficulty"] == difficulty)]
    return [{k: v for k, v in q.items() if k not in ("answer", "explanation")} for q in qs[:max(1, min(limit, 100))]]


class QuizAnswers(BaseModel):
    answers: dict[str, int]
    uid: Optional[str] = None
    topic: Optional[str] = None


@app.post("/api/practice/quiz/grade")
def grade_quiz(body: QuizAnswers):
    results = []
    correct = 0
    for qid, choice in body.answers.items():
        q = QUESTIONS.get(qid)
        if not q:
            continue
        ok = choice == q["answer"]
        correct += ok
        results.append({"id": qid, "correct": ok, "answer": q["answer"], "explanation": q["explanation"]})
    total = len(results)
    db.record(body.uid, "quiz", body.topic or "mixed", correct, max(1, total), total > 0 and correct / total >= 0.7)
    return {"correct": correct, "total": total, "score": round(100 * correct / total) if total else 0, "results": results}


@app.get("/api/practice/estimations")
def estimations():
    return [{k: v for k, v in e.items() if k not in ("answer", "steps")} for e in ESTIMATIONS]


class EstAnswer(BaseModel):
    value: float
    uid: Optional[str] = None


@app.post("/api/practice/estimations/{eid}/check")
def check_estimation(eid: str, body: EstAnswer):
    e = E_MAP.get(eid)
    if not e:
        raise HTTPException(404, "estimation not found")
    ans = e["answer"]
    ratio = body.value / ans if ans else 0
    rel = abs(body.value - ans) / ans if ans else 0
    ok = rel <= e["tolerance"]
    verdict = ("Spot on" if rel <= e["tolerance"] / 2 else "Within tolerance") if ok else (
        "Too high" if ratio > 1 else "Too low")
    order_ok = 0.33 <= ratio <= 3 if ratio > 0 else False
    db.record(body.uid, "estimation", eid, 1 if ok else 0, 1, ok)
    return {"correct": ok, "verdict": verdict, "answer": round(ans, 2), "error_pct": round(rel * 100, 1),
            "right_order_of_magnitude": order_ok, "steps": e["steps"], "unit": e["unit"]}


@app.get("/api/practice/interviews")
def interviews():
    return [{k: v for k, v in i.items() if k != "reference"} | {"has_reference": True} for i in INTERVIEWS]


@app.get("/api/practice/interviews/{iid}")
def interview(iid: str):
    i = I_MAP.get(iid)
    if not i:
        raise HTTPException(404, "interview not found")
    return i


class RubricSubmit(BaseModel):
    checked: list[int]
    uid: Optional[str] = None


@app.post("/api/practice/interviews/{iid}/self-assess")
def self_assess(iid: str, body: RubricSubmit):
    i = I_MAP.get(iid)
    if not i:
        raise HTTPException(404, "interview not found")
    total = len(i["rubric"])
    got = len({c for c in body.checked if 0 <= c < total})
    pct = round(100 * got / total)
    level = ("Strong hire" if pct >= 90 else "Hire" if pct >= 70 else "Lean hire" if pct >= 55 else "Needs practice")
    missed = [r for idx, r in enumerate(i["rubric"]) if idx not in body.checked]
    db.record(body.uid, "interview", iid, got, total, pct >= 70)
    return {"score": pct, "level": level, "missed": missed}


# ------------------------------------------------------------------ progress & designs
@app.get("/api/progress/{uid}")
def get_progress(uid: str):
    p = db.progress(uid)
    totals = {
        "scenarios": {"done": sum(1 for v in p.get("scenario", {}).values() if v["passed"]), "total": len(SCENARIOS)},
        "estimations": {"done": sum(1 for v in p.get("estimation", {}).values() if v["passed"]), "total": len(ESTIMATIONS)},
        "interviews": {"done": sum(1 for v in p.get("interview", {}).values() if v["passed"]), "total": len(INTERVIEWS)},
        "quizzes": {"done": sum(1 for v in p.get("quiz", {}).values() if v["passed"]), "total": len(TOPICS)},
    }
    return {"detail": p, "totals": totals}


class DesignSave(BaseModel):
    uid: str = Field(min_length=4, max_length=64)
    name: str = Field(min_length=1, max_length=80)
    graph: dict


@app.post("/api/designs")
def save_design(body: DesignSave):
    db.save_design(body.uid, body.name, json.dumps(body.graph))
    return {"ok": True}


@app.get("/api/designs/{uid}")
def designs(uid: str):
    return [{"name": d["name"], "graph": json.loads(d["graph"]), "updated_at": d["updated_at"]} for d in db.list_designs(uid)]


@app.delete("/api/designs/{uid}/{name}")
def del_design(uid: str, name: str):
    db.delete_design(uid, name)
    return {"ok": True}
