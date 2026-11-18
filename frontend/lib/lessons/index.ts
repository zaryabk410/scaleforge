import { cases } from "./cases";
import { data } from "./data";
import { foundations } from "./foundations";
import { reliability } from "./reliability";
import type { Lesson } from "./types";

export const LESSONS: Lesson[] = [...foundations, ...data, ...reliability, ...cases];

export const TRACKS: { id: Lesson["track"]; title: string; blurb: string; color: string }[] = [
  { id: "foundations", title: "Foundations", blurb: "Scaling out, balancing load, caching and the edge.", color: "#d4603a" },
  { id: "data", title: "Data at Scale", blurb: "Replication, sharding, hashing, consistency and consensus.", color: "#7a5ca6" },
  { id: "reliability", title: "Async & Reliability", blurb: "Queues, rate limits, resilient services and SLOs.", color: "#2c7c77" },
  { id: "case-studies", title: "Whole Systems", blurb: "End-to-end designs from one server to millions of users.", color: "#dca22c" },
];

export function getLesson(slug: string) {
  return LESSONS.find((l) => l.slug === slug);
}

export function neighbours(slug: string) {
  const i = LESSONS.findIndex((l) => l.slug === slug);
  return { prev: i > 0 ? LESSONS[i - 1] : undefined, next: i < LESSONS.length - 1 ? LESSONS[i + 1] : undefined };
}

export type { Lesson } from "./types";
