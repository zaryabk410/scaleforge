import type { NodeKind } from "../kinds";

export type SceneNode = { id: string; type: NodeKind; label: string; pos: [number, number] };
export type Flow = [from: string, to: string, color?: string, rate?: number];

export type Step = {
  title: string;
  body: string;
  show?: string[];          // node ids visible in this step (default: all)
  hot?: string[];           // overloaded / highlighted
  down?: string[];          // failed
  focus?: string[];         // gently bobbing / emphasised
  badges?: Record<string, string>;
  flows: Flow[];
  edges?: [string, string][]; // extra edges for this step only
};

export type Section = { title: string; body: string };
export type Tradeoff = { option: string; pros: string[]; cons: string[] };

export type Lesson = {
  slug: string;
  track: "foundations" | "data" | "reliability" | "case-studies";
  title: string;
  subtitle: string;
  level: "beginner" | "intermediate" | "advanced" | "expert";
  minutes: number;
  scene: { nodes: SceneNode[]; edges: [string, string][] };
  steps: Step[];
  sections: Section[];
  keyNumbers?: { label: string; value: string }[];
  tradeoffs?: Tradeoff[];
  pitfalls?: string[];
  interview?: string[];
  lab?: { href: string; label: string }[];
  quizTopic?: string;
};

export const C = {
  req: "#d4603a",
  ok: "#3f8a4f",
  read: "#3a6fb0",
  write: "#7a5ca6",
  async: "#dca22c",
  err: "#c4402e",
  vote: "#2c7c77",
} as const;
