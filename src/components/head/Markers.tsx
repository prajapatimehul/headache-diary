"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { heatThree } from "./heat";

/**
 * A single placed pain mark. Stored verbatim in Entry.regions (Dexie/SQL).
 * NOTE: `local` is the authoritative position — markers are rendered as children
 * of the head group using local coords, so they rotate and persist with the head
 * (the "pain constellation"). `world` is kept for debugging / 2D projection only.
 */
export type PainMark = {
  id: string;
  regionId: string;
  regionLabel: string;
  intensity: number; // 0..10
  color: string; // resolved heat color at placement time (CSS rgb string)
  local: [number, number, number];
  world: [number, number, number];
  ts: number; // Date.now()
};

const CORE_RADIUS = 0.018;

/**
 * Renders the accumulated pain markers. MUST be mounted as a child of the head
 * group (alongside the skull mesh) so it shares the head's transform — that's
 * what makes the constellation rotate with the head and survive re-renders.
 *
 * Each mark is a small emissive core + a soft additive halo. Both glow scales
 * with intensity. The single most-recent mark gets a calm breathing pulse
 * (disabled under prefers-reduced-motion).
 */
export function Markers({ marks }: { marks: PainMark[] }) {
  const newestTs = marks.length
    ? marks.reduce((m, x) => (x.ts > m ? x.ts : m), 0)
    : 0;

  return (
    <group>
      {marks.map((m) => (
        <Marker key={m.id} mark={m} isNewest={m.ts === newestTs} />
      ))}
    </group>
  );
}

function Marker({ mark, isNewest }: { mark: PainMark; isNewest: boolean }) {
  const haloRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // intensity 0..10 -> glow & size factors
  const t = THREE.MathUtils.clamp(mark.intensity, 0, 10) / 10;
  const color = useMemo(() => heatThree(mark.intensity), [mark.intensity]);

  // core emissive ramps with pain; halo gets bigger + brighter at high pain
  const coreEmissive = 0.6 + t * 1.6; // 0.6 .. 2.2
  const haloScale = 1.9 + t * 2.6; // relative to core radius
  const haloOpacity = 0.1 + t * 0.28; // 0.10 .. 0.38

  useFrame((state) => {
    if (reduceMotion) return;
    // Gentle, photophobia-safe breathing on the newest mark only.
    if (isNewest && haloRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.6) * 0.08;
      haloRef.current.scale.setScalar(haloScale * pulse);
    }
  });

  return (
    <group position={mark.local}>
      {/* soft additive halo — the "bloom" that signals intensity */}
      <mesh ref={haloRef} scale={haloScale} renderOrder={2}>
        <sphereGeometry args={[CORE_RADIUS, 20, 20]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={haloOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* bright emissive core — true heat color (toneMapped off so reds read) */}
      <mesh ref={coreRef} renderOrder={3}>
        <sphereGeometry args={[CORE_RADIUS, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={coreEmissive}
          roughness={0.35}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
