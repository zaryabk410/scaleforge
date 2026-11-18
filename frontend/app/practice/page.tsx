import { Suspense } from "react";
import PracticeTabs from "@/components/practice/PracticeTabs";

export const metadata = { title: "Practice — ScaleForge" };

export default function PracticePage() {
  return (
    <main className="container wide page">
      <div className="eyebrow">Practice</div>
      <h1 style={{ marginBottom: 6 }}>Drill until it is automatic</h1>
      <p className="muted" style={{ maxWidth: 820 }}>Graded quizzes with explanations, back-of-the-envelope estimation drills, timed mock interviews with rubrics and reference designs, and a capacity calculator.</p>
      <Suspense fallback={<div className="muted">Loading…</div>}>
        <PracticeTabs />
      </Suspense>
    </main>
  );
}
