import Link from "next/link";
import { LESSONS, TRACKS } from "@/lib/lessons";

export default function LessonGrid() {
  let n = 0;
  return (
    <>
      {TRACKS.map((t) => (
        <section key={t.id}>
          <div className="track-h">
            <span className="dot" style={{ background: t.color, width: 12, height: 12 }} />
            <h2>{t.title}</h2>
            <span className="muted small">{t.blurb}</span>
          </div>
          <div className="grid g3">
            {LESSONS.filter((l) => l.track === t.id).map((l) => {
              n += 1;
              return (
                <Link key={l.slug} href={`/learn/${l.slug}`} className="card link lesson-card">
                  <div className="row between">
                    <span className="num">{String(n).padStart(2, "0")}</span>
                    <span className={`pill ${l.level}`}>{l.level}</span>
                  </div>
                  <h3>{l.title}</h3>
                  <p className="muted small" style={{ margin: 0 }}>{l.subtitle}</p>
                  <div className="spacer" />
                  <div className="row small muted">
                    <span>{l.steps.length} animated steps</span>·<span>{l.minutes} min</span>
                    {l.lab && <>·<span>{l.lab.length} lab{l.lab.length > 1 ? "s" : ""}</span></>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
