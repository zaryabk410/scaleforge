import { notFound } from "next/navigation";
import LessonView from "@/components/LessonView";
import { LESSONS, getLesson, neighbours } from "@/lib/lessons";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ slug: l.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const l = getLesson(params.slug);
  return { title: l ? `${l.title} — ScaleForge` : "Lesson — ScaleForge" };
}

export default function LessonPage({ params }: { params: { slug: string } }) {
  const lesson = getLesson(params.slug);
  if (!lesson) notFound();
  const { prev, next } = neighbours(params.slug);
  return (
    <LessonView
      slug={lesson.slug}
      prev={prev ? { slug: prev.slug, title: prev.title } : undefined}
      next={next ? { slug: next.slug, title: next.title } : undefined}
    />
  );
}
