"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Estimations, Estimator } from "./Estimations";
import Interviews from "./Interviews";
import Quiz from "./Quiz";

const TABS = [
  { id: "quiz", label: "Quizzes" },
  { id: "estimations", label: "Estimation drills" },
  { id: "interviews", label: "Mock interviews" },
  { id: "estimator", label: "Capacity calculator" },
];

export default function PracticeTabs() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") || "quiz";
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="tabs">
        {TABS.map((t) => <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => router.replace(`/practice?tab=${t.id}`, { scroll: false })}>{t.label}</button>)}
      </div>
      {tab === "quiz" && <Quiz initialTopic={params.get("topic") || undefined} />}
      {tab === "estimations" && <Estimations />}
      {tab === "interviews" && <Interviews initialId={params.get("id") || undefined} />}
      {tab === "estimator" && <Estimator />}
    </div>
  );
}
