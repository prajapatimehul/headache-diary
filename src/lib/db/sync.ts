import { db, type Entry } from "./index";
import { createClient } from "@/lib/supabase/client";

/**
 * Local-first sync. Last-write-wins by `updated_at` — the simplest correct
 * strategy for a single-user-per-account diary.
 *
 * - `saveEntry` writes locally first (instant / offline-safe), marks the row
 *   dirty, then best-effort pushes when online.
 * - `pushDirty` upserts all dirty rows to Supabase. `onConflict:'user_id,date'`
 *   + the server-side `updated_at` trigger make pushes idempotent / retry-safe.
 *   The client-only `_dirty` flag is stripped before sending.
 * - `pullAndMerge` pulls remote rows and merges by `updated_at` (newer wins),
 *   then flushes anything still dirty. Call on login / app start.
 *
 * RLS guarantees `.eq("user_id", user.id)` can never leak other users' rows
 * even if the filter were forgotten.
 */

/** Write locally first (instant/offline), mark dirty, then best-effort push. */
export async function saveEntry(e: Entry) {
  e.updated_at = new Date().toISOString();
  e._dirty = 1;
  await db.entries.put(e);
  if (typeof navigator !== "undefined" && navigator.onLine) {
    void pushDirty();
  }
}

/** Push all dirty rows to Supabase (upsert on the unique key). */
export async function pushDirty() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const dirty = await db.entries.where("_dirty").equals(1).toArray();
  for (const row of dirty) {
    // Strip the client-only sync flag; stamp the owning user.
    const { _dirty, ...payload } = { ...row, user_id: user.id };
    void _dirty;
    const { error } = await supabase
      .from("entries")
      .upsert(payload, { onConflict: "user_id,date" });
    if (!error) {
      await db.entries.update(row.id, { _dirty: 0, user_id: user.id });
    }
  }
}

/** Pull remote + merge into Dexie by `updated_at` (newer wins). Call on login. */
export async function pullAndMerge() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: remote, error } = await supabase
    .from("entries")
    .select("*")
    .eq("user_id", user.id);
  if (error || !remote) return;

  await db.transaction("rw", db.entries, async () => {
    for (const r of remote as Entry[]) {
      const local = await db.entries.get(r.id);
      if (!local || new Date(r.updated_at) > new Date(local.updated_at)) {
        await db.entries.put({ ...r, _dirty: 0 });
      }
    }
  });

  // After pulling, flush anything still dirty locally.
  await pushDirty();
}

/**
 * Wire reconnect flushing once at app start, e.g. from a client effect:
 *   window.addEventListener("online", () => void pushDirty());
 */
