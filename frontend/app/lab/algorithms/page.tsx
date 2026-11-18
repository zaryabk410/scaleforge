import { Suspense } from "react";
import AlgoTabs from "@/components/algos/AlgoTabs";

export const metadata = { title: "Algorithm Labs — ScaleForge" };

export default function AlgorithmsPage() {
  return (
    <main className="container wide page">
      <div className="eyebrow">Algorithm labs</div>
      <h1 style={{ marginBottom: 6 }}>The algorithms behind the boxes</h1>
      <p className="muted" style={{ maxWidth: 820 }}>Every lab runs on the Python backend with real implementations, not canned animations. Change parameters, rerun, and watch the behaviour change.</p>
      <Suspense fallback={<div className="muted">Loading…</div>}>
        <AlgoTabs />
      </Suspense>
    </main>
  );
}
