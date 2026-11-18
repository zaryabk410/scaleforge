# ScaleForge — Interactive System Design Course + Practice Lab

Learn system design end to end: animated 3D lessons, a traffic simulator with graded challenges,
algorithm labs, practice drills, mock interviews and a printable cheatsheet.

- **Frontend:** Next.js 14 (App Router, TypeScript) + Three.js via @react-three/fiber / drei
- **Backend:** Python 3.11+ FastAPI (simulation engine, algorithm labs, grading, progress in SQLite)

## Features

| Area | What you get |
|---|---|
| **Learn** (`/learn`) | 18 lessons in 4 tracks (Foundations, Data at Scale, Async & Reliability, Whole Systems). Each has a step-through isometric 3D scene (packets flow, nodes overheat, fail and fail over), deep-dive sections, trade-offs, key numbers, pitfalls, interview tips, and links into labs and quizzes. |
| **Simulator** (`/lab`) | Drag-and-drop architecture builder (13 component types). Tick-based Python engine: queueing latency, load shedding, cache-aside fall-through, CDN offload, queues and backlog, DB primaries, replicas and shards, autoscaling with boot delay, failure injection and failover. Output: p50/p95/p99, errors, throughput, cost/month, per-node utilisation timeline, SPOF and anti-pattern review, replay scrubber, live 3D view, save/load/export. |
| **Challenges** | 8 graded scenarios (Hello Scale → Sharded Ledger) with chaos events and pass criteria. Every one has a verified reference solution in `backend/tests/solutions.py`. |
| **Algorithm labs** (`/lab/algorithms`) | Consistent hashing ring (vnodes, add/remove, vs mod-N), sharding strategies and hot spots, 5 rate limiters side by side, a real Raft implementation (elections, replication, commits, crashes, partitions) with frame playback, cache eviction (LRU/LFU/FIFO/Random/W-TinyLFU vs Belady), and Dynamo N/R/W quorums. |
| **Practice** (`/practice`) | 62 quiz questions graded server-side with explanations, 12 estimation drills with worked answers, 7 timed mock interviews with rubrics, hints, notes and reference designs (openable in the simulator and in 3D), and a capacity calculator. |
| **Cheatsheet** (`/cheatsheet`) | 19 searchable, printable cards: latency numbers, nines, formulas, datastore choice, caching, consistency, CAP/PACELC, queues, rate limiting, resilience, sharding, IDs, HTTP codes, interview framework. |
| **Progress** (`/progress`) | Lessons, challenges, quizzes, estimations and interviews, tracked per anonymous browser id. |

## Run locally

```bash
# 1) Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000           # API docs: http://localhost:8000/docs
pytest                                              # 31 tests

# 2) Frontend (new terminal)
cd frontend
npm install
npm run dev                                         # http://localhost:3000
```

The frontend proxies `/api/*` to `BACKEND_URL` (default `http://localhost:8000`, see `frontend/.env.example`).

### Docker

```bash
docker compose up --build    # http://localhost:3000
```

## Project layout

```
backend/app/
  main.py              FastAPI routes
  sim/engine.py        Tick simulator (fluid propagation + Monte-Carlo latency sampling)
  sim/analyzer.py      SPOF / anti-pattern / hot-spot review
  sim/scenarios.py     Challenges + grading
  labs/                hashing.py, ratelimit.py, raft.py, cache.py, quorum.py
  practice/            quizzes.py, drills.py (estimations, interviews + reference graphs)
  db.py                SQLite progress + saved designs
frontend/
  app/                 pages: /, /learn, /learn/[slug], /lab, /lab/algorithms, /practice, /cheatsheet, /progress
  components/three/    IsoScene.tsx: the isometric Three.js renderer used everywhere
  components/lab/      Builder, Canvas (SVG editor), Inspector, Results
  components/algos/    the six algorithm labs
  components/practice/ Quiz, Estimations + calculator, Interviews
  lib/lessons/         lesson content (scene graphs, steps, deep dives)
  lib/cheatsheet.ts    cheatsheet content
```

## Simulation model (short version)

- Each node has capacity (req/s per replica) and base latency. Service time = `base × (1 + 0.5·ρ/(1−ρ))`; above 100% utilisation the excess is shed.
- Load balancers split traffic by healthy capacity and skip dead targets. Clients, gateways and services split evenly, with no failover.
- Services send reads to caches first (cache-aside misses fall through to sibling databases) and writes to queues when present.
- SQL writes cost 2× on the primary. Read replicas share reads. Shards divide everything. Losing a primary blocks writes for ~3 s while a replica is promoted.
- Queues ACK immediately and drain at consumer capacity; the backlog is tracked.
- Autoscaling targets 55% utilisation with a 3 s boot delay.

## Adding content

- **Lesson:** add an object to a file in `frontend/lib/lessons/` (scene nodes and edges, steps with `show/hot/down/flows`, sections).
- **Challenge:** add to `SCENARIOS` in `backend/app/sim/scenarios.py`, plus a reference solution in `tests/solutions.py`. The tests check that it can be passed.
- **Quiz:** call `q(...)` in `backend/app/practice/quizzes.py`.
