"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LessonGrid from "@/components/LessonGrid";
import Scene, { type SceneEdgeView, type SceneNodeView } from "@/components/three/Scene";
import { C } from "@/lib/lessons/types";

const HERO_NODES: SceneNodeView[] = [
  { id: "u", type: "client", label: "Millions of users", pos: [-7, 0] },
  { id: "cdn", type: "cdn", label: "CDN", pos: [-4, -3] },
  { id: "lb", type: "lb", label: "Load balancer", pos: [-4, 1.5] },
  { id: "a", type: "server", label: "App", pos: [-0.5, -1.5] },
  { id: "b", type: "server", label: "App", pos: [-0.5, 1.5] },
  { id: "c", type: "server", label: "App", pos: [-0.5, 4.5] },
  { id: "cache", type: "cache", label: "Cache", pos: [3, -2.5] },
  { id: "db", type: "db", label: "Sharded DB", pos: [3, 1] },
  { id: "q", type: "queue", label: "Queue", pos: [3, 4.5] },
  { id: "w", type: "worker", label: "Workers", pos: [6.5, 4.5] },
];

const PHASES: { label: string; hot?: string[]; down?: string[]; flows: [string, string, string, number][] }[] = [
  { label: "Normal day", flows: [["u", "cdn", C.ok, 2], ["u", "lb", C.req, 2], ["lb", "a", C.req, 1], ["lb", "b", C.req, 1], ["lb", "c", C.req, 1], ["a", "cache", C.ok, 1], ["b", "cache", C.ok, 1], ["b", "db", C.read, 0.6], ["c", "q", C.async, 1], ["q", "w", C.async, 1]] },
  { label: "Traffic spike", hot: ["a", "b", "c"], flows: [["u", "cdn", C.ok, 3], ["u", "lb", C.err, 3], ["lb", "a", C.err, 2], ["lb", "b", C.err, 2], ["lb", "c", C.err, 2], ["a", "cache", C.ok, 2], ["b", "db", C.read, 1.2], ["c", "q", C.async, 2], ["q", "w", C.async, 1]] },
  { label: "Server failure", down: ["b"], flows: [["u", "cdn", C.ok, 2], ["u", "lb", C.req, 2], ["lb", "a", C.req, 1.5], ["lb", "c", C.req, 1.5], ["a", "cache", C.ok, 1], ["a", "db", C.read, 0.6], ["c", "q", C.async, 1], ["q", "w", C.async, 1]] },
];

const EDGES: [string, string][] = [["u", "cdn"], ["u", "lb"], ["lb", "a"], ["lb", "b"], ["lb", "c"], ["a", "cache"], ["b", "cache"], ["a", "db"], ["b", "db"], ["c", "q"], ["q", "w"], ["w", "db"]];

const FEATURES = [
  { n: "01", title: "Animated 3D lessons", href: "/learn", text: "18 lessons with step-through isometric diagrams: packets flow, servers overheat, nodes die and fail over." },
  { n: "02", title: "Traffic simulator", href: "/lab", text: "Drag components onto a canvas, wire them up, and fire real traffic profiles at them. Get p50/p95/p99, errors, cost and SPOF analysis from a Python engine." },
  { n: "03", title: "Graded challenges", href: "/lab?challenge=hello-scale", text: "8 scenarios from 'Hello, Scale' to 'Sharded Ledger', with chaos injection, autoscaling and pass/fail criteria." },
  { n: "04", title: "Algorithm labs", href: "/lab/algorithms", text: "Consistent hashing, sharding, five rate limiters, Raft consensus, cache eviction and quorum replication, all running live." },
  { n: "05", title: "Practice", href: "/practice", text: "60 quiz questions, estimation drills with worked answers, and timed mock interviews with rubrics and reference designs." },
  { n: "06", title: "Cheatsheet", href: "/cheatsheet", text: "Latency numbers, capacity formulas, database choice matrix, patterns and an interview framework on one printable page." },
];

export default function Home() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % PHASES.length), 5000);
    return () => clearInterval(t);
  }, []);
  const ph = PHASES[phase];
  const nodes = HERO_NODES.map((n) => ({ ...n, state: ph.down?.includes(n.id) ? "down" as const : ph.hot?.includes(n.id) ? "hot" as const : "normal" as const }));
  const flowMap = new Map(ph.flows.map((f) => [`${f[0]}>${f[1]}`, f]));
  const edges: SceneEdgeView[] = EDGES.map(([a, b]) => {
    const f = flowMap.get(`${a}>${b}`);
    return { from: a, to: b, color: f?.[2], rate: f?.[3] ?? 0 };
  });

  return (
    <main>
      <div className="container wide">
        <section className="hero">
          <div>
            <div className="eyebrow">Interactive system design course + lab</div>
            <h1>Design systems that <em>scale</em>. Then try to break them.</h1>
            <p className="muted" style={{ fontSize: "1.08rem", maxWidth: 560 }}>
              Learn load balancing, caching, sharding, consensus and queues through animated diagrams, then build
              architectures in a simulator that pushes real traffic, injects failures and grades your design.
            </p>
            <div className="row" style={{ marginTop: 18 }}>
              <Link href="/learn/scalability-basics" className="btn accent">Start learning →</Link>
              <Link href="/lab" className="btn ghost">Open the simulator</Link>
            </div>
            <div className="row small muted" style={{ marginTop: 22, gap: 18 }}>
              <span><b className="mono">18</b> lessons</span>
              <span><b className="mono">8</b> graded challenges</span>
              <span><b className="mono">6</b> algorithm labs</span>
              <span><b className="mono">60+</b> practice items</span>
            </div>
          </div>
          <div className="hero-scene" style={{ position: "relative" }}>
            <div className="legend"><span><b>{ph.label}</b></span></div>
            <Scene nodes={nodes} edges={edges} autoRotate interactive />
          </div>
        </section>
      </div>

      <div className="container">
        <section style={{ margin: "30px 0 10px" }}>
          <div className="grid g3">
            {FEATURES.map((f) => (
              <Link key={f.n} href={f.href} className="card link">
                <div className="feature-n">{f.n}</div>
                <h3 style={{ marginTop: 6 }}>{f.title}</h3>
                <p className="small muted" style={{ margin: 0 }}>{f.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="card flat" style={{ margin: "34px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {[
            ["Learn", "Step through the idea in 3D and read the deep dive."],
            ["Build", "Recreate it in the simulator from components."],
            ["Break", "Spike traffic, kill nodes, drop the cache."],
            ["Prove", "Pass the challenge, quiz and mock interview."],
          ].map(([t, d], k) => (
            <div key={t}>
              <div className="mono tiny muted">STEP {k + 1}</div>
              <h3 style={{ margin: "4px 0" }}>{t}</h3>
              <p className="small muted" style={{ margin: 0 }}>{d}</p>
            </div>
          ))}
        </section>

        <LessonGrid />
      </div>
      <div style={{ height: 60 }} />
    </main>
  );
}
