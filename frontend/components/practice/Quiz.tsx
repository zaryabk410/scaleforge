"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUid } from "@/lib/uid";

type Q = { id: string; topic: string; difficulty: string; prompt: string; options: string[] };
type Graded = { correct: number; total: number; score: number; results: { id: string; correct: boolean; answer: number; explanation: string }[] };

const pretty = (t: string) => t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function Quiz({ initialTopic }: { initialTopic?: string }) {
  const [topics, setTopics] = useState<{ topic: string; count: number }[]>([]);
  const [topic, setTopic] = useState(initialTopic || "");
  const [qs, setQs] = useState<Q[]>([]);
  const [ans, setAns] = useState<Record<string, number>>({});
  const [graded, setGraded] = useState<Graded | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => { api<{ topic: string; count: number }[]>("/practice/topics").then(setTopics).catch((e) => setErr(e.message)); }, []);
  useEffect(() => {
    setGraded(null);
    setAns({});
    api<Q[]>(`/practice/quiz?limit=100${topic ? `&topic=${topic}` : ""}`).then((all) => {
      const shuffled = [...all].sort(() => Math.random() - 0.5);
      setQs(topic ? shuffled : shuffled.slice(0, 12));
    }).catch((e) => setErr(e.message));
  }, [topic]);

  const submit = async () => {
    try {
      setGraded(await api<Graded>("/practice/quiz/grade", { answers: ans, uid: getUid(), topic: topic || "mixed" }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) { setErr(e.message); }
  };
  const result = (id: string) => graded?.results.find((r) => r.id === id);

  return (
    <div className="grid" style={{ gridTemplateColumns: "260px minmax(0, 1fr)", gap: 18 }}>
      <div className="panel" style={{ alignSelf: "start" }}><div className="panel-h">Topics</div><div className="panel-b stack" style={{ gap: 4 }}>
        <button className={`btn ${topic === "" ? "" : "ghost"} sm`} onClick={() => setTopic("")}>Mixed (12 random)</button>
        {topics.map((t) => (
          <button key={t.topic} className={`btn ${topic === t.topic ? "" : "ghost"} sm`} style={{ justifyContent: "space-between" }} onClick={() => setTopic(t.topic)}>
            {pretty(t.topic)} <span className="mono tiny">{t.count}</span>
          </button>
        ))}
      </div></div>
      <div className="stack" style={{ gap: 14 }}>
        {err && <div className="err-banner">{err}</div>}
        {graded && (
          <div className={`alert ${graded.score >= 70 ? "ok" : "warn"}`}>
            <b>{graded.correct}/{graded.total} correct · {graded.score}%</b> {graded.score >= 70 ? "Passed. Nice work." : "Review the explanations below and try again."}
            <button className="btn ghost sm" style={{ marginLeft: 12 }} onClick={() => { setGraded(null); setAns({}); setQs([...qs].sort(() => Math.random() - 0.5)); }}>Retry</button>
          </div>
        )}
        {qs.map((q, qi) => {
          const r = result(q.id);
          return (
            <div key={q.id} className="card flat">
              <div className="row between small"><span className="mono muted">Q{qi + 1} · {pretty(q.topic)}</span><span className={`pill ${q.difficulty}`}>{q.difficulty}</span></div>
              <h3 style={{ margin: "8px 0 12px", fontFamily: "var(--sans)", fontSize: "1.02rem" }}>{q.prompt}</h3>
              {q.options.map((o, oi) => {
                let cls = ans[q.id] === oi ? "sel" : "";
                if (r) cls = oi === r.answer ? "right" : ans[q.id] === oi ? "wrong" : "";
                return (
                  <div key={oi} className={`q-opt ${cls}`} onClick={() => !graded && setAns({ ...ans, [q.id]: oi })}>
                    <span className="mono small">{String.fromCharCode(65 + oi)}</span><span className="small">{o}</span>
                  </div>
                );
              })}
              {r && <div className={`alert ${r.correct ? "ok" : "critical"} small`} style={{ marginTop: 6 }}>{r.correct ? "Correct. " : "Not quite. "}{r.explanation}</div>}
            </div>
          );
        })}
        {!graded && qs.length > 0 && (
          <div className="row">
            <button className="btn accent" onClick={submit} disabled={Object.keys(ans).length === 0}>Submit {Object.keys(ans).length}/{qs.length} answers</button>
          </div>
        )}
      </div>
    </div>
  );
}
