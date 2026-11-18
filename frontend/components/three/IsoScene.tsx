"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, OrthographicCamera, RoundedBox } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { KINDS, type NodeKind } from "@/lib/kinds";

export type NodeState = "normal" | "hot" | "down" | "dim" | "focus";
export type SceneNodeView = { id: string; type: NodeKind; label: string; pos: [number, number]; state?: NodeState; badge?: string };
export type SceneEdgeView = { from: string; to: string; color?: string; rate?: number; dashed?: boolean; dim?: boolean };

type Props = {
  nodes: SceneNodeView[];
  edges: SceneEdgeView[];
  interactive?: boolean;
  autoRotate?: boolean;
  padding?: number;
};

const TILE = "#e4d9c8";
const DOWN = "#a49a8e";

function useAppear(ref: React.RefObject<THREE.Group>) {
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const s = g.scale.x + (1 - g.scale.x) * Math.min(1, dt * 9);
    g.scale.setScalar(s);
  });
}

function Mat({ color, state, emissive }: { color: string; state: NodeState; emissive?: boolean }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    if (state === "hot") m.emissiveIntensity = 0.35 + 0.3 * Math.sin(clock.elapsedTime * 7);
    else m.emissiveIntensity = emissive ? 0.6 : 0;
  });
  const c = state === "down" ? DOWN : color;
  return (
    <meshStandardMaterial
      ref={ref}
      color={c}
      roughness={0.55}
      metalness={0.05}
      emissive={state === "hot" ? "#ff5a1f" : emissive ? c : "#000000"}
      transparent={state === "dim" || state === "down"}
      opacity={state === "dim" ? 0.28 : state === "down" ? 0.55 : 1}
    />
  );
}

function Person({ x, z, color, state }: { x: number; z: number; color: string; state: NodeState }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.2, 0.46, 16]} />
        <Mat color={color} state={state} />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <sphereGeometry args={[0.15, 18, 18]} />
        <Mat color="#e9b48a" state={state} />
      </mesh>
    </group>
  );
}

function Shape({ type, state }: { type: NodeKind; state: NodeState }) {
  const color = KINDS[type].color;
  const spin = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (spin.current && state !== "down") spin.current.rotation.y += dt * (state === "hot" ? 3 : 0.8);
  });
  switch (type) {
    case "client":
      return (
        <group>
          <Person x={-0.35} z={0.15} color={color} state={state} />
          <Person x={0.2} z={-0.3} color="#8b7f73" state={state} />
          <Person x={0.3} z={0.35} color="#a0907f" state={state} />
        </group>
      );
    case "dns":
      return (
        <group>
          <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.05, 0.05, 0.9, 8]} /><Mat color="#6b625a" state={state} /></mesh>
          <mesh position={[0, 0.9, 0]}><boxGeometry args={[0.9, 0.36, 0.08]} /><Mat color={color} state={state} /></mesh>
        </group>
      );
    case "cdn":
      return (
        <group position={[0, 0.72, 0]}>
          <mesh ref={spin} castShadow><sphereGeometry args={[0.52, 28, 28]} /><Mat color={color} state={state} /></mesh>
          <mesh><sphereGeometry args={[0.56, 12, 10]} /><meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.35} /></mesh>
        </group>
      );
    case "lb":
      return (
        <group>
          <mesh position={[0, 0.27, 0]} castShadow><cylinderGeometry args={[0.66, 0.7, 0.3, 6]} /><Mat color={color} state={state} /></mesh>
          <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[0.42, 0.5, 0.16, 6]} /><Mat color="#5fb0a8" state={state} /></mesh>
        </group>
      );
    case "gateway":
      return (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow><cylinderGeometry args={[0.52, 0.6, 0.66, 8]} /><Mat color={color} state={state} /></mesh>
          <mesh ref={spin} position={[0, 0.85, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.38, 0.06, 10, 32]} /><Mat color="#e8d8b0" state={state} /></mesh>
        </group>
      );
    case "server":
      return (
        <group>
          {[0.27, 0.6, 0.93].map((y, i) => (
            <group key={i} position={[0, y, 0]}>
              <RoundedBox args={[0.9, 0.28, 0.8]} radius={0.04} castShadow><Mat color={color} state={state} /></RoundedBox>
              <mesh position={[0.3, 0, 0.405]}><boxGeometry args={[0.08, 0.06, 0.01]} /><Mat color={state === "down" ? "#555" : "#9df08a"} state={state} emissive={state !== "down"} /></mesh>
              <mesh position={[-0.1, 0, 0.405]}><boxGeometry args={[0.4, 0.03, 0.01]} /><meshBasicMaterial color="#00000033" /></mesh>
            </group>
          ))}
        </group>
      );
    case "cache":
      return (
        <group>
          <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.5, 0.5, 0.3, 32]} /><Mat color={color} state={state} /></mesh>
          <mesh position={[0, 0.68, 0]} castShadow><cylinderGeometry args={[0.5, 0.5, 0.3, 32]} /><Mat color={color} state={state} /></mesh>
          <mesh ref={spin} position={[0, 1.02, 0]}><octahedronGeometry args={[0.18]} /><Mat color="#ffd25a" state={state} emissive /></mesh>
        </group>
      );
    case "db":
      return (
        <group>
          {[0.25, 0.58, 0.91].map((y, i) => (
            <mesh key={i} position={[0, y, 0]} castShadow><cylinderGeometry args={[0.55, 0.55, 0.26, 36]} /><Mat color={i === 2 ? "#9278bf" : color} state={state} /></mesh>
          ))}
        </group>
      );
    case "nosql":
      return (
        <group>
          {[[-0.22, 0.25, -0.22], [0.22, 0.25, -0.22], [-0.22, 0.25, 0.22], [0.22, 0.25, 0.22], [0, 0.68, 0]].map((p, i) => (
            <RoundedBox key={i} args={[0.4, 0.4, 0.4]} radius={0.05} position={p as [number, number, number]} castShadow>
              <Mat color={i === 4 ? "#b48ad0" : color} state={state} />
            </RoundedBox>
          ))}
        </group>
      );
    case "queue":
      return (
        <group>
          <RoundedBox args={[1.35, 0.22, 0.6]} radius={0.05} position={[0, 0.2, 0]} castShadow><Mat color="#8a6d2a" state={state} /></RoundedBox>
          {[-0.45, -0.15, 0.15, 0.45].map((x, i) => (
            <RoundedBox key={i} args={[0.24, 0.3, 0.44]} radius={0.04} position={[x, 0.47, 0]} castShadow><Mat color={color} state={state} /></RoundedBox>
          ))}
        </group>
      );
    case "worker":
      return (
        <group>
          <RoundedBox args={[0.8, 0.55, 0.8]} radius={0.06} position={[0, 0.38, 0]} castShadow><Mat color={color} state={state} /></RoundedBox>
          <mesh ref={spin} position={[0, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.24, 0.08, 6, 8]} /><Mat color="#e7c77a" state={state} /></mesh>
        </group>
      );
    case "storage":
      return (
        <group>
          <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.55, 0.38, 0.78, 28]} /><Mat color={color} state={state} /></mesh>
          <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.57, 0.57, 0.06, 28]} /><Mat color="#8fb3d6" state={state} /></mesh>
        </group>
      );
    case "search":
      return (
        <group>
          <mesh position={[0, 0.85, 0]} rotation={[0, Math.PI / 4, 0]}><torusGeometry args={[0.32, 0.08, 12, 32]} /><Mat color={color} state={state} /></mesh>
          <mesh position={[0.25, 0.38, 0.25]} rotation={[0.6, Math.PI / 4, 0]}><cylinderGeometry args={[0.07, 0.07, 0.55, 10]} /><Mat color="#3d5a2a" state={state} /></mesh>
          <mesh position={[0, 0.85, 0]} rotation={[0, Math.PI / 4, 0]}><circleGeometry args={[0.26, 24]} /><meshBasicMaterial color="#cfe6ff" transparent opacity={0.5} side={THREE.DoubleSide} /></mesh>
        </group>
      );
  }
}

function SceneNode({ n }: { n: SceneNodeView }) {
  const ref = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const state = n.state || "normal";
  useAppear(ref);
  useFrame(({ clock }) => {
    if (bob.current) bob.current.position.y = state === "focus" ? 0.12 + Math.sin(clock.elapsedTime * 3) * 0.06 : 0;
  });
  return (
    <group ref={ref} position={[n.pos[0], 0, n.pos[1]]} scale={0.01}>
      <RoundedBox args={[1.7, 0.14, 1.7]} radius={0.06} position={[0, 0.07, 0]} receiveShadow>
        <meshStandardMaterial color={state === "hot" ? "#f0c9b4" : state === "down" ? "#d8cfc4" : TILE} transparent={state === "dim"} opacity={state === "dim" ? 0.35 : 1} />
      </RoundedBox>
      <group ref={bob}>
        <group position={[0, 0.14, 0]}>
          <Shape type={n.type} state={state} />
        </group>
      </group>
      {state === "down" && (
        <group position={[0, 1.4, 0]}>
          <mesh rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[0.7, 0.1, 0.1]} /><meshBasicMaterial color="#c4402e" /></mesh>
          <mesh rotation={[0, 0, -Math.PI / 4]}><boxGeometry args={[0.7, 0.1, 0.1]} /><meshBasicMaterial color="#c4402e" /></mesh>
        </group>
      )}
      {state !== "dim" && (
        <Html position={[0, 1.65, 0]} center zIndexRange={[10, 0]}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            {n.badge && <div className="n3-badge">{n.badge}</div>}
            <div className={`n3-label ${state}`}>{n.label}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function Packets({ a, b, color, rate }: { a: THREE.Vector3; b: THREE.Vector3; color: string; rate: number }) {
  const count = Math.max(1, Math.min(9, Math.round(rate * 3)));
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const speed = 0.45 + rate * 0.08;
  const len = a.distanceTo(b);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed * (4 / Math.max(2, len));
    for (let i = 0; i < count; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const p = (t + i / count) % 1;
      m.position.lerpVectors(a, b, p);
      m.position.y = 0.42 + Math.sin(p * Math.PI) * 0.35;
      const s = p < 0.08 ? p / 0.08 : p > 0.92 ? (1 - p) / 0.08 : 1;
      m.scale.setScalar(Math.max(0.01, s));
    }
  });
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }}>
          <sphereGeometry args={[0.11, 14, 14]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
        </mesh>
      ))}
    </>
  );
}

function Rig({ extent, padding }: { extent: number; padding: number }) {
  const { camera, size } = useThree();
  const target = Math.min(size.width, size.height * 1.25) / (extent + padding);
  const last = useRef(0);
  const active = useRef(true);
  if (Math.abs(last.current - target) > 0.01) {
    last.current = target;
    active.current = true; // re-fit only when the layout or viewport changes; user zoom wins otherwise
  }
  useFrame((_, dt) => {
    if (!active.current) return;
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom += (target - cam.zoom) * Math.min(1, dt * 5);
    if (Math.abs(cam.zoom - target) < 0.2) active.current = false;
    cam.updateProjectionMatrix();
  });
  return null;
}

export default function IsoScene({ nodes, edges, interactive = true, autoRotate = false, padding = 2.4 }: Props) {
  const { offset, extent, byId } = useMemo(() => {
    const xs = nodes.map((n) => n.pos[0]);
    const zs = nodes.map((n) => n.pos[1]);
    const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 0);
    const minZ = Math.min(...zs, 0), maxZ = Math.max(...zs, 0);
    const off: [number, number] = [-(minX + maxX) / 2, -(minZ + maxZ) / 2];
    const ext = Math.max(maxX - minX, maxZ - minZ, 3) * 1.08;
    const map = new Map<string, THREE.Vector3>();
    nodes.forEach((n) => map.set(n.id, new THREE.Vector3(n.pos[0] + off[0], 0.3, n.pos[1] + off[1])));
    return { offset: off, extent: ext, byId: map };
  }, [nodes]);

  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ width: "100%", height: "100%" }}>
      <OrthographicCamera makeDefault position={[14, 14, 14]} zoom={40} near={-100} far={200} />
      <Rig extent={extent} padding={padding} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 14, 6]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-14, 14, 14, -14, 0.1, 50]} />
      </directionalLight>
      <hemisphereLight args={["#fff6e8", "#c9b9a3", 0.35]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <shadowMaterial opacity={0.12} />
      </mesh>
      <gridHelper args={[60, 60, "#e2d6c4", "#e9dfd0"]} position={[0, -0.005, 0]} />

      {edges.map((e, i) => {
        const a = byId.get(e.from), b = byId.get(e.to);
        if (!a || !b) return null;
        return (
          <group key={`${e.from}-${e.to}-${i}`}>
            <Line points={[[a.x, 0.16, a.z], [b.x, 0.16, b.z]]} color={e.dim ? "#d6cab8" : "#a89a86"} lineWidth={e.dim ? 1.2 : 2.2}
              dashed={!!e.dashed} dashSize={0.25} gapSize={0.18} />
            {!!e.rate && e.rate > 0 && <Packets a={a} b={b} color={e.color || "#d4603a"} rate={e.rate} />}
          </group>
        );
      })}

      {nodes.map((n) => (
        <SceneNode key={n.id} n={{ ...n, pos: [n.pos[0] + offset[0], n.pos[1] + offset[1]] }} />
      ))}

      <OrbitControls
        enabled={interactive}
        enablePan={false}
        enableZoom={interactive}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.6}
        minZoom={12}
        maxZoom={160}
      />
    </Canvas>
  );
}
