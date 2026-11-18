import { Suspense } from "react";
import Builder from "@/components/lab/Builder";

export const metadata = { title: "Simulator — ScaleForge" };

export default function LabPage() {
  return (
    <main className="container wide page">
      <div className="row between" style={{ alignItems: "flex-end", marginBottom: 14 }}>
        <div>
          <div className="eyebrow">Practice lab</div>
          <h1 style={{ marginBottom: 4 }}>Architecture simulator</h1>
          <p className="muted" style={{ margin: 0, maxWidth: 820 }}>
            Build an architecture, fire a traffic profile at it and watch a tick-by-tick Python simulation: utilisation, queueing
            latency, load shedding, autoscaling, failover, cache stampedes and cost. Pick a challenge to get graded.
          </p>
        </div>
      </div>
      <Suspense fallback={<div className="muted">Loading lab…</div>}>
        <Builder />
      </Suspense>
    </main>
  );
}
