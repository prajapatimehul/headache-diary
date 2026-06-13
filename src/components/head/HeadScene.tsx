"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Bvh,
  AdaptiveDpr,
  AdaptiveEvents,
  PerformanceMonitor,
} from "@react-three/drei";
import { Suspense, useRef, useState } from "react";
import * as THREE from "three";
import { HeadModel } from "./HeadModel";
import type { PainMark } from "./Markers";

/**
 * The premium 3D scene — the app's centerpiece.
 *
 * DESIGN.md: a softly-lit studio (neutral IBL + cool rim), a single grounded
 * contact shadow, a calm dark scene; the head floats with rotational inertia;
 * tap places a marker. Nothing strobes (photophobia-safe).
 *
 * Consumed via next/dynamic({ ssr:false }) — three.js touches WebGL/window and
 * must never SSR.
 *
 * Props are controlled by the parent (the diary surface owns the slider value
 * and the marks array so it can persist them to Dexie):
 *  - intensity: 0..10 current pain value the next tap will record
 *  - marks: the accumulated PainMark[] to render (the "pain constellation")
 *  - onPlace: called with a new PainMark when the user taps the head
 */
export default function HeadScene({
  intensity,
  marks,
  onPlace,
}: {
  intensity: number;
  marks: PainMark[];
  onPlace: (m: PainMark) => void;
}) {
  // Cap DPR for battery/FPS on high-density phones; degrade on weak hardware.
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas
      shadows
      dpr={[1, dpr]}
      camera={{ position: [0, 0.05, 2.6], fov: 35, near: 0.1, far: 100 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0); // transparent; CSS gradient shows through
      }}
    >
      {/* auto-degrade on sustained low FPS (mid-range Android) */}
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(1.5)}
      />

      {/* calm dark backdrop behind the head (very dark, slight cool tint) */}
      <color attach="background" args={["#0b0f13"]} />
      <fog attach="fog" args={["#0b0f13", 4.5, 9]} />

      {/* ---------- studio lighting ---------- */}
      <ambientLight intensity={0.28} />
      {/* soft warm-neutral key from upper-front-right */}
      <directionalLight
        position={[3.2, 4.2, 4.5]}
        intensity={1.5}
        color="#fff4ea"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      >
        <orthographicCamera attach="shadow-camera" args={[-2, 2, 2, -2, 0.1, 12]} />
      </directionalLight>
      {/* cool rim from behind-left to carve the silhouette */}
      <directionalLight position={[-4, 2.2, -3.5]} intensity={0.8} color="#8fb6ff" />
      {/* faint seafoam fill from below-front to lift the jaw/neck */}
      <pointLight position={[0, -1.4, 2.2]} intensity={0.35} color="#57c7be" distance={6} />

      <Suspense fallback={null}>
        <RevealRig>
          {/* Only the head is BVH-accelerated & interactive; brain/ears inside
              HeadModel carry no handlers so taps always hit the skull. */}
          <Bvh firstHitOnly>
            <HeadModel intensity={intensity} marks={marks} onPlace={onPlace} />
          </Bvh>
        </RevealRig>

        {/* neutral IBL for the porcelain material's soft specular */}
        <Environment preset="studio" environmentIntensity={0.55} />
      </Suspense>

      {/* one grounded soft shadow under the head/shoulders */}
      <ContactShadows
        position={[0, -1.18, 0]}
        opacity={0.45}
        scale={6}
        blur={3.0}
        far={2.2}
        resolution={512}
        color="#04080b"
      />

      {/* rotate with inertia; locked distance, no pan, gentle vertical clamp */}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.85}
        zoomSpeed={0.6}
        minDistance={1.9}
        maxDistance={3.6}
        minPolarAngle={Math.PI * 0.22}
        maxPolarAngle={Math.PI * 0.82}
        target={[0, -0.02, 0]}
      />

      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </Canvas>
  );
}

/**
 * Orchestrated reveal + calm idle drift for the whole head assembly.
 *  - On mount: fade/scale/settle in (one gentle entrance, ~700ms).
 *  - Idle: a very slow horizontal sway so the floating head feels alive.
 * Both are disabled under prefers-reduced-motion. OrbitControls damping handles
 * the "inertia" feel during user interaction; this rig only animates the group's
 * own transform, never fighting the camera.
 */
function RevealRig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);

  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    if (reduceMotion) {
      g.scale.setScalar(1);
      return;
    }
    if (start.current === null) start.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - start.current;

    // entrance: ease-out over ~0.7s (scale 0.94 -> 1, slight settle on Y)
    const reveal = THREE.MathUtils.clamp(t / 0.7, 0, 1);
    const eased = 1 - Math.pow(1 - reveal, 3);
    const s = THREE.MathUtils.lerp(0.94, 1, eased);
    g.scale.setScalar(s);
    g.position.y = THREE.MathUtils.lerp(0.06, 0, eased);

    // idle: barely-there sway once settled (kept tiny so it reads as calm float)
    if (reveal >= 1) {
      g.rotation.y = Math.sin(state.clock.elapsedTime * 0.18) * 0.05;
    }
  });

  return <group ref={group}>{children}</group>;
}
