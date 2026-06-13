import * as THREE from "three";

/**
 * The 17 canonical pain regions (CONTRACT.md §"Region vocabulary" layer 1).
 * These ids are stored verbatim in PainMark.regionId. EntryForm maps them to the
 * 6 ICHD anatomical pain_regions.
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
export type Centroid = Region & { p: THREE.Vector3 };

/**
 * Region directions as fractions of the head's bounding-box half-extents, so the
 * centroids are derived from whatever head mesh is loaded (model-independent).
 * Convention (head LOCAL space, model faces +Z):
 *   +X = patient's LEFT, -X = patient's RIGHT
 *   +Y = up (crown),     -Y = down (jaw / neck)
 *   +Z = face front,     -Z = back of head (occiput)
 */
const REGION_DIRS: { id: RegionId; label: string; f: [number, number, number] }[] = [
  { id: "forehead-center", label: "Center forehead", f: [0, 0.62, 0.78] },
  { id: "forehead-left", label: "Left forehead", f: [0.4, 0.58, 0.66] },
  { id: "forehead-right", label: "Right forehead", f: [-0.4, 0.58, 0.66] },

  { id: "eye-left", label: "Left eye / brow", f: [0.34, 0.16, 0.9] },
  { id: "eye-right", label: "Right eye / brow", f: [-0.34, 0.16, 0.9] },

  { id: "temple-left", label: "Left temple", f: [0.9, 0.3, 0.32] },
  { id: "temple-right", label: "Right temple", f: [-0.9, 0.3, 0.32] },

  { id: "vertex", label: "Top of head", f: [0, 0.97, 0.05] },

  { id: "occiput-center", label: "Center back of head", f: [0, 0.42, -0.95] },
  { id: "occiput-left", label: "Left back of head", f: [0.42, 0.4, -0.82] },
  { id: "occiput-right", label: "Right back of head", f: [-0.42, 0.4, -0.82] },

  { id: "subocciput-left", label: "Left base of skull", f: [0.3, -0.12, -0.84] },
  { id: "subocciput-right", label: "Right base of skull", f: [-0.3, -0.12, -0.84] },

  { id: "neck-upper-left", label: "Left upper neck", f: [0.22, -0.82, -0.5] },
  { id: "neck-upper-right", label: "Right upper neck", f: [-0.22, -0.82, -0.5] },

  { id: "trapezius-left", label: "Left trapezius", f: [0.55, -0.97, -0.42] },
  { id: "trapezius-right", label: "Right trapezius", f: [-0.55, -0.97, -0.42] },
];

/**
 * Build the region centroids from a head mesh's bounding box. Each centroid sits
 * at center + fraction × half-extent along each axis, so it lands near the
 * surface of whatever head geometry is loaded.
 */
export function buildCentroids(box: THREE.Box3): Centroid[] {
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  return REGION_DIRS.map(({ id, label, f }) => ({
    id,
    label,
    p: new THREE.Vector3(
      center.x + f[0] * half.x,
      center.y + f[1] * half.y,
      center.z + f[2] * half.z,
    ),
  }));
}

/**
 * Nearest-centroid classifier. `local` is a hit point already converted to the
 * head's LOCAL space; `centroids` come from buildCentroids(). Squared distance
 * (no per-candidate sqrt). Stable under rotation (same local frame).
 */
export function classifyRegion(
  local: THREE.Vector3,
  centroids: Centroid[],
): Region {
  let best = centroids[0];
  let bestD = Infinity;
  for (const c of centroids) {
    const d = c.p.distanceToSquared(local);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return { id: best.id, label: best.label };
}
