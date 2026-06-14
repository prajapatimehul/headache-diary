import { db, type Entry } from "./index";
import { createClient } from "@/lib/supabase/client";

/**
 * Local-first sync. Last-write-wins by `updated_at` — the simplest correct
 * strategy for a single-user-per-account diary.
 *
 * - `saveEntry` writes locally first (instant / offline-safe), enforces one row
 *   per calendar day (a re-save edits in place), marks the row dirty, then
 *   best-effort pushes when online.
 * - `pushDirty` upserts all dirty rows to Supabase. `onConflict:'user_id,date'`
 *   + the server-side `updated_at` trigger make pushes idempotent / retry-safe.
 *   It THROWS if any row fails to upload so callers (e.g. the "Sync now" button)
 *   can tell the user instead of falsely reporting success.
 * - `pullAndMerge` pulls remote rows and merges by `updated_at` (newer wins),
 *   reconciling rows by date so a divergent local `id` can't create a duplicate
 *   day. THROWS on a real pull failure (vs. an empty result).
 *
 * RLS guarantees `.eq("user_id", user.id)` can never leak other users' rows
 * even if the filter were forgotten.
 */

/** Write locally first (instant/offline), mark dirty, then best-effort push. */
export async function saveEntry(e: Entry) {
  // One entry per calendar day: if a row already exists for this date, edit it
  // in place (reuse its id/created_at) instead of inserting a duplicate.
  const existing = await db.entries.where("date").equals(e.date).first();
  if (existing) {
    e.id = existing.id;
    e.created_at = existing.created_at;
  }
  e.updated_at = new Date().toISOString();
  e._dirty = 1;
  await db.entries.put(e);
  if (typeof navigator !== "undefined" && navigator.onLine) {
    // Best-effort; never let a background rejection go unhandled.
    void pushDirty().catch((err) =>
      console.error("[sync] background push failed", err),
    );
  }
}

/**
 * Push all dirty rows to Supabase (upsert on the unique key).
 * Throws if any row fails so the UI can report a real sync failure.
 */
export async function pushDirty(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const dirty = await db.entries.where("_dirty").equals(1).toArray();
  let failures = 0;
  let lastError: string | null = null;

  for (const row of dirty) {
    // Strip the client-only sync flag; stamp the owning user.
    const { _dirty, ...payload } = { ...row, user_id: user.id };
    void _dirty;
    const { error } = await supabase
      .from("entries")
      .upsert(payload, { onConflict: "user_id,date" });
    if (error) {
      failures++;
      lastError = error.message;
      console.error("[sync] push failed for", row.date, error.message);
      continue;
    }
    await db.entries.update(row.id, { _dirty: 0, user_id: user.id });
  }

  if (failures > 0) {
    throw new Error(
      `${failures} ${failures === 1 ? "entry" : "entries"} didn't sync${
        lastError ? `: ${lastError}` : ""
      }`,
    );
  }
}

/** Pull remote + merge into Dexie by `updated_at` (newer wins). Call on login. */
export async function pullAndMerge(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: remote, error } = await supabase
    .from("entries")
    .select("*")
    .eq("user_id", user.id);
  if (error) {
    console.error("[sync] pull failed", error.message);
    throw new Error(`Couldn't fetch your synced entries: ${error.message}`);
  }
  if (!remote) return;

  await db.transaction("rw", db.entries, async () => {
    for (const r of remote as Entry[]) {
      // Match by id first, then by date — so a row created with a different id
      // on another device reconciles to one row per day instead of duplicating.
      const local =
        (await db.entries.get(r.id)) ??
        (await db.entries.where("date").equals(r.date).first());
      const remoteNewer =
        !local || new Date(r.updated_at) > new Date(local.updated_at);
      if (remoteNewer) {
        if (local && local.id !== r.id) await db.entries.delete(local.id);
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
