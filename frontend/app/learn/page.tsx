import LessonGrid from "@/components/LessonGrid";
import { LESSONS } from "@/lib/lessons";

export const metadata = { title: "Learn — ScaleForge" };

export default function LearnPage() {
  const steps = LESSONS.reduce((a, l) => a + l.steps.length, 0);
  return (
    <main className="container page">
      <div className="eyebrow">Curriculum</div>
      <h1>Learn system design, one animated idea at a time</h1>
      <p className="muted" style={{ maxWidth: 720 }}>
        {LESSONS.length} lessons and {steps} step-through 3D diagrams. Every lesson ends with deep dives, trade-offs,
        key numbers, interview tips, and links into the simulator and algorithm labs so you can break the design yourself.
      </p>
      <LessonGrid />
    </main>
  );
}
