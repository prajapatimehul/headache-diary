"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { classifyRegion, shapeHead, HEAD_RADIUS, EAR_ANCHORS } from "./regions";
import { heatColor } from "./heat";
import { Markers, type PainMark } from "./Markers";

const TAP_PX = 8; // max pointer travel (screen px) to still count as a tap
const TAP_MS = 300; // max press duration to count as a tap

/**
 * The procedural head — the app's centerpiece. There is NO .glb; the skull/face
 * is a deformed sphere generated from shapeHead() (the same shaping function the
 * region centroids use, so classification is calibrated by construction). Ears
 * give orientation; a faint translucent brain floats inside for beauty.
 *
 * Interaction: tap (not drag) drops a PainMark at the hit point. The hit is
 * converted to LOCAL space before classify so region labels are stable under
 * rotation. Markers are rendered as children of THIS group, so they rotate and
 * persist with the head.
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

  // ---- procedural geometries (built once) ----
  const headGeom = useMemo(() => buildHeadGeometry(), []);
  const brainGeom = useMemo(() => buildBrainGeometry(), []);
  const earGeom = useMemo(() => buildEarGeometry(), []);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* setPointerCapture can throw if the target detached; safe to ignore */
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

    // World hit -> LOCAL space (rotation/scale invariant) for stable classify.
    const localPoint = e.point
      .clone()
      .applyMatrix4(e.object.matrixWorld.clone().invert());
    const region = classifyRegion(localPoint);

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
      {/* ---- skull + face: the ONLY raycast target (has pointer handlers) ---- */}
      <mesh
        geometry={headGeom}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        castShadow
        receiveShadow
      >
        {/* matte porcelain / graphite with a faint cool sheen — a product render,
            not a medical-textbook head (DESIGN.md). */}
        <meshPhysicalMaterial
          color="#cfd6db"
          roughness={0.78}
          metalness={0}
          clearcoat={0.12}
          clearcoatRoughness={0.6}
          sheen={0.5}
          sheenRoughness={0.7}
          sheenColor="#9fb4c4"
          envMapIntensity={0.7}
        />
      </mesh>

      {/* ---- ears (orientation cues) — no handlers => not raycast targets ---- */}
      {EAR_ANCHORS.map((ear) => (
        <mesh
          key={ear.side}
          geometry={earGeom}
          position={ear.pos}
          rotation={[0, ear.side === "L" ? Math.PI / 2 : -Math.PI / 2, 0]}
          scale={[0.5, 0.85, 0.32]}
          castShadow
        >
          <meshPhysicalMaterial
            color="#cfd6db"
            roughness={0.78}
            metalness={0}
            sheen={0.4}
            sheenColor="#9fb4c4"
            envMapIntensity={0.7}
          />
        </mesh>
      ))}

      {/* ---- faint translucent brain inside, for beauty/orientation ----
          No pointer handlers + depthWrite=false => never steals a tap. */}
      <mesh geometry={brainGeom} renderOrder={1} scale={0.82} position={[0, 0.04, -0.02]}>
        <meshPhysicalMaterial
          color="#57c7be"
          emissive="#1f9e95"
          emissiveIntensity={0.18}
          transparent
          opacity={0.12}
          depthWrite={false}
          roughness={0.5}
          metalness={0}
          transmission={0.4}
          thickness={0.4}
        />
      </mesh>

      {/* ---- pain constellation: child of this group => rotates with the head ---- */}
      <Markers marks={marks} />
    </group>
  );
}

// ============================================================================
// Procedural geometry builders
// ============================================================================

/** Sphere displaced through shapeHead() -> smooth porcelain head + neck. */
function buildHeadGeometry(): THREE.BufferGeometry {
  // High-ish res for a smooth silhouette; BVH (in the scene) keeps raycast cheap.
  const geo = new THREE.SphereGeometry(1, 128, 96);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    dir.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    const p = shapeHead(dir);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/** A lumpy two-lobe brain (icosahedron + low-freq noise + a central fissure). */
function buildBrainGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(HEAD_RADIUS * 0.92, 6);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const n = v.clone().normalize();
    // gyri/sulci: a few stacked sine bands give a convincing folded surface
    const folds =
      0.03 * Math.sin(n.x * 14 + n.y * 9) +
      0.025 * Math.sin(n.y * 13 - n.z * 11) +
      0.02 * Math.sin(n.z * 16 + n.x * 7);
    // longitudinal fissure: pinch along the x=0 midline
    const fissure = -0.05 * Math.exp(-(n.x * n.x) / 0.01);
    // squash slightly front-to-back & taper the underside
    v.multiplyScalar(1 + folds + fissure);
    v.z *= 1.05;
    v.y *= 0.95;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** A simple flattened ear blob (scaled/positioned by the caller). */
function buildEarGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.16, 24, 24);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    // dish the front face inward a touch for an ear-like concavity
    if (v.z > 0) v.z *= 0.6;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
