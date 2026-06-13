import * as THREE from "three";

/**
 * The 17 canonical pain regions (CONTRACT.md §"Region vocabulary" layer 1).
 * These ids are stored verbatim in PainMark.regionId. The EntryForm later maps
 * them to the 6 ICHD anatomical pain_regions; that mapping lives in EntryForm,
 * not here.
 */
export type RegionId =
  | "forehead-left"
  | "forehead-center"
  | "forehead-right"
  | "temple-left"
  | "temple-right"
  | "eye-left"
  | "eye-right"
  | "vertex"
  | "occiput-left"
  | "occiput-center"
  | "occiput-right"
  | "subocciput-left"
  | "subocciput-right"
  | "neck-upper-left"
  | "neck-upper-right"
  | "trapezius-left"
  | "trapezius-right";

export type Region = { id: RegionId; label: string };

// ============================================================================
// Shared head geometry shaping — SINGLE SOURCE OF TRUTH
// ----------------------------------------------------------------------------
// Both HeadModel (the rendered mesh) and the region centroids below are derived
// from the SAME shaping function. That guarantees every centroid sits exactly on
// the procedural skin, so nearest-centroid classification is calibrated by
// construction (no manual "log localPoint and paste" step needed).
//
// Convention (LOCAL space, matches the snippet & ICHD anatomy):
//   +Y = up (crown), -Y = down (neck/chin)
//   +Z = face front,  -Z = back of head (occiput)
//   +X = patient's LEFT,  -X = patient's RIGHT
// The head+neck assembly is roughly centered on the origin; ContactShadows in
// the scene sit at y = -0.85 under the shoulders.
// ============================================================================

/** Base radius of the cranium sphere before anatomical displacement. */
export const HEAD_RADIUS = 0.62;

const _tmp = new THREE.Vector3();

/**
 * Displace a unit direction on the sphere into the final head surface point.
 * `dir` MUST be normalized. Returns a new Vector3 in LOCAL space.
 *
 * The shaping is a sum of smooth, low-frequency deformations chosen to read as a
 * calm, premium porcelain head rather than an anatomy-textbook model:
 *  - vertical egg-taper (narrower jaw, fuller cranium)
 *  - slight front/back flattening of the face & a gentle occipital bulge
 *  - a soft brow ridge, a nose ridge, cheek/jaw fullness
 *  - a tapered neck column below the jaw line
 */
export function shapeHead(dir: THREE.Vector3): THREE.Vector3 {
  const x = dir.x;
  const y = dir.y;
  const z = dir.z;

  // --- overall ellipsoid: a touch taller than wide, slightly deep ---
  let r = HEAD_RADIUS;
  const ellipsoid =
    1.0 /
    Math.sqrt(
      (x * x) / (1.02 * 1.02) +
        (y * y) / (1.16 * 1.16) +
        (z * z) / (1.04 * 1.04),
    );
  r *= ellipsoid;

  // --- jaw / chin taper: pull lower-front inward to suggest a jawline ---
  const lower = THREE.MathUtils.smoothstep(-y, 0.15, 0.95); // 0 up -> 1 down
  const front = THREE.MathUtils.smoothstep(z, 0.0, 1.0); // back 0 -> front 1
  r -= 0.10 * lower * (0.4 + 0.6 * front); // chin/jaw tuck

  // --- crown fullness: keep the cranium round & full up top ---
  const up = THREE.MathUtils.smoothstep(y, 0.2, 1.0);
  r += 0.015 * up;

  // --- occipital bulge: gentle fullness at back of skull ---
  const back = THREE.MathUtils.smoothstep(-z, 0.1, 1.0);
  const midBand = 1.0 - Math.abs(y - 0.05) * 1.6; // strongest around eye/ear height
  r += 0.05 * back * Math.max(0, midBand);

  // --- brow ridge: subtle horizontal swell across the forehead front ---
  const browBand = gaussian(y, 0.28, 0.10) * front;
  r += 0.012 * browBand;

  // --- cheekbones: soft fullness on the front-sides below the eyes ---
  const cheekBand = gaussian(y, -0.02, 0.16) * front * smootherAbsX(x, 0.35, 0.9);
  r += 0.02 * cheekBand;

  // base point on the (shaped) cranium/face
  const p = _tmp.set(x, y, z).multiplyScalar(r).clone();

  // --- nose: a small ridge protruding forward on the centerline, mid-face ---
  const noseY = gaussian(y, 0.0, 0.085);
  const noseX = gaussian(x, 0.0, 0.10);
  const noseFront = THREE.MathUtils.smoothstep(z, 0.55, 1.0);
  const nose = noseY * noseX * noseFront;
  p.z += 0.10 * nose;
  p.y -= 0.015 * nose; // tip droops a hair

  // --- neck column: below the jaw, blend the silhouette into a vertical neck ---
  // For strongly-downward directions, override toward a cylinder so we don't get
  // a pointy chin-cone but a believable neck + shoulder fade.
  const neckBlend = THREE.MathUtils.smoothstep(-y, 0.62, 1.05);
  if (neckBlend > 0) {
    const neckRadius = 0.30;
    const horiz = Math.hypot(x, z) || 1e-5;
    const nx = (x / horiz) * neckRadius;
    const nz = (z / horiz) * neckRadius * 0.92;
    // y of the neck point: extend downward proportional to how far below we point
    const ny = -0.55 - 0.55 * THREE.MathUtils.smoothstep(-y, 0.7, 1.1);
    p.x = THREE.MathUtils.lerp(p.x, nx, neckBlend);
    p.z = THREE.MathUtils.lerp(p.z, nz, neckBlend);
    p.y = THREE.MathUtils.lerp(p.y, ny, neckBlend);
  }

  return p;
}

/** Gaussian bump, peak 1 at `mu`, width `sigma`. */
function gaussian(v: number, mu: number, sigma: number): number {
  const d = (v - mu) / sigma;
  return Math.exp(-0.5 * d * d);
}

/** 1 near |x|~peak (cheekbone offset), tapering to 0 at center & far edge. */
function smootherAbsX(x: number, peak: number, falloff: number): number {
  const a = Math.abs(x);
  return gaussian(a, peak, falloff * 0.35);
}

/**
 * Ear anchor positions (LOCAL space) for the two ear meshes the model adds for
 * orientation. Slightly behind mid-face, at roughly eye height, on each side.
 */
export const EAR_ANCHORS: { side: "L" | "R"; pos: [number, number, number] }[] = [
  { side: "L", pos: [HEAD_RADIUS * 1.0, 0.04, -0.04] },
  { side: "R", pos: [-HEAD_RADIUS * 1.0, 0.04, -0.04] },
];

// ============================================================================
// Region centroids — computed by projecting each region's spherical direction
// through shapeHead(), so they land ON the procedural surface. A few (neck /
// trapezius) live below the jaw on the neck column and are placed by hand in the
// same coordinate frame.
// ============================================================================

/** (yaw°, pitch°) -> normalized direction. yaw 0 = front (+Z); pitch 0 = equator. */
function dir(yawDeg: number, pitchDeg: number): THREE.Vector3 {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  const cp = Math.cos(pitch);
  return new THREE.Vector3(
    Math.sin(yaw) * cp, // +X = patient left when yaw > 0
    Math.sin(pitch), // +Y up
    Math.cos(yaw) * cp, // +Z front
  ).normalize();
}

/** Surface point for a (yaw,pitch) direction. */
function surf(yawDeg: number, pitchDeg: number): [number, number, number] {
  const p = shapeHead(dir(yawDeg, pitchDeg));
  return [p.x, p.y, p.z];
}

type Centroid = Region & { p: [number, number, number] };

export const REGION_CENTROIDS: Centroid[] = [
  // ---- forehead (front, upper) ----
  { id: "forehead-left", label: "Left forehead", p: surf(28, 30) },
  { id: "forehead-center", label: "Center forehead", p: surf(0, 32) },
  { id: "forehead-right", label: "Right forehead", p: surf(-28, 30) },

  // ---- temples (front-sides, eye height) ----
  { id: "temple-left", label: "Left temple", p: surf(72, 12) },
  { id: "temple-right", label: "Right temple", p: surf(-72, 12) },

  // ---- eyes / periorbital (front, just below brow) ----
  { id: "eye-left", label: "Left eye area", p: surf(22, 6) },
  { id: "eye-right", label: "Right eye area", p: surf(-22, 6) },

  // ---- vertex (crown) ----
  { id: "vertex", label: "Top of head", p: surf(0, 86) },

  // ---- occiput (back of skull, upper-mid) ----
  { id: "occiput-left", label: "Left back of head", p: surf(150, 18) },
  { id: "occiput-center", label: "Center back of head", p: surf(180, 16) },
  { id: "occiput-right", label: "Right back of head", p: surf(-150, 18) },

  // ---- suboccipital (base of skull, just above neck) ----
  { id: "subocciput-left", label: "Left base of skull", p: surf(160, -20) },
  { id: "subocciput-right", label: "Right base of skull", p: surf(-160, -20) },

  // ---- upper neck (on the neck column, behind, below skull base) ----
  { id: "neck-upper-left", label: "Left upper neck", p: [0.2, -0.5, -0.22] },
  { id: "neck-upper-right", label: "Right upper neck", p: [-0.2, -0.5, -0.22] },

  // ---- trapezius (lower neck / shoulder ridge, further out & down) ----
  { id: "trapezius-left", label: "Left trapezius", p: [0.34, -0.78, -0.14] },
  { id: "trapezius-right", label: "Right trapezius", p: [-0.34, -0.78, -0.14] },
];

const _candidate = new THREE.Vector3();

/**
 * Nearest-centroid classifier. Takes a hit point already converted to the head's
 * LOCAL space and returns the closest region. Uses squared distance (no sqrt per
 * candidate). Stable under rotation because both the hit and the centroids live
 * in the same local frame.
 */
export function classifyRegion(local: THREE.Vector3): Region {
  let best: Centroid = REGION_CENTROIDS[0];
  let bestD = Infinity;
  for (const c of REGION_CENTROIDS) {
    const d = _candidate.set(c.p[0], c.p[1], c.p[2]).distanceToSquared(local);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return { id: best.id, label: best.label };
}
