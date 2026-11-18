"use client";

import dynamic from "next/dynamic";

const IsoScene = dynamic(() => import("./IsoScene"), {
  ssr: false,
  loading: () => <div className="center muted small" style={{ paddingTop: "30%" }}>Loading 3D scene…</div>,
});

export default IsoScene;
export type { SceneNodeView, SceneEdgeView, NodeState } from "./IsoScene";
