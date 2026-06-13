"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { buildCentroids, classifyRegion } from "./regions";
import { heatColor } from "./heat";
import { Markers, type PainMark } from "./Markers";

const TAP_PX = 8; // max pointer travel (screen px) to still count as a tap
const TAP_MS = 300; // max press duration to count as a tap
const TARGET_HEIGHT = 1.55; // normalize the model to ~unit scene scale

const MODEL_URL = "/head.glb";

/**
 * The 3D head — a real sculpted human head (LeePerrySmith, three.js examples,
 * CC-BY by Lee Perry-Smith / Infinite-Realities). Loaded from /head.glb, then
 * normalized (centered + scaled to ~1.55 units) so it frames in the existing
 * scene and the tiny markers read at the right size. We override the model's
 * material with a calm matte-porcelain look (DESIGN.md) rather than skin.
 *
 * Region centroids are derived from the *normalized* bounding box, so tapping
 * the brow, temple, occiput, etc. classifies correctly with no hand-tuning.
 *
 * Interaction: a tap (not a drag) drops a PainMark at the hit point; the hit is
 * converted to LOCAL space before classify so labels are stable under rotation.
 * Markers render as children of this group, so the constellation rotates with
 * the head.
 */
export function HeadModel({
  intensity,
  marks,
  onPlace,
}: {
  intensity: number;
  marks: PainMark[];
  onPlace: (m: PainMark) => void;
}) {
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const { nodes } = useGLTF(MODEL_URL) as unknown as {
    nodes: Record<string, THREE.Mesh>;
  };

  // Normalize geometry once, and derive region centroids from its bbox.
  const { geom, centroids } = useMemo(() => {
    const src =
      (nodes.LeePerrySmith as THREE.Mesh | undefined)?.geometry ??
      (Object.values(nodes).find((n) => (n as THREE.Mesh).geometry)
        ?.geometry as THREE.BufferGeometry);
    const g = (src as THREE.BufferGeometry).clone();
    g.computeBoundingBox();
    const box0 = g.boundingBox!;
    const center = box0.getCenter(new THREE.Vector3());
    const size = box0.getSize(new THREE.Vector3());
    const scale = TARGET_HEIGHT / size.y;
    g.translate(-center.x, -center.y, -center.z);
    g.scale(scale, scale, scale);
    g.computeBoundingBox();
    g.computeVertexNormals();
    return { geom: g, centroids: buildCentroids(g.boundingBox!) };
  }, [nodes]);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* setPointerCapture can throw if target detached; ignore */
    }
    down.current = {
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY,
      t: performance.now(),
    };
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const d = down.current;
    down.current = null;
    if (!d) return;

    const moved = Math.hypot(
      e.nativeEvent.clientX - d.x,
      e.nativeEvent.clientY - d.y,
    );
    const elapsed = performance.now() - d.t;
    if (moved > TAP_PX || elapsed > TAP_MS) return; // a rotate/drag, not a tap

    const localPoint = e.point
      .clone()
      .applyMatrix4(e.object.matrixWorld.clone().invert());
    const region = classifyRegion(localPoint, centroids);

    onPlace({
      id: crypto.randomUUID(),
      regionId: region.id,
      regionLabel: region.label,
      intensity,
      color: heatColor(intensity),
      local: [localPoint.x, localPoint.y, localPoint.z],
      world: [e.point.x, e.point.y, e.point.z],
      ts: Date.now(),
    });
  };

  return (
    <group>
      <mesh
        geometry={geom}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        castShadow
        receiveShadow
      >
        {/* matte porcelain / graphite with a faint cool sheen — a calm product
            render, not realistic skin (DESIGN.md). */}
        <meshPhysicalMaterial
          color="#d7dde2"
          roughness={0.74}
          metalness={0}
          clearcoat={0.14}
          clearcoatRoughness={0.55}
          sheen={0.5}
          sheenRoughness={0.7}
          sheenColor="#a7bccb"
          envMapIntensity={0.75}
        />
      </mesh>

      {/* pain constellation — child of this group => rotates with the head */}
      <Markers marks={marks} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
