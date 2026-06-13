Versions confirmed against npm. The npm registry shows react is at 19.2.7 (newer than the blueprint's 19.2.6) and date-fns at 4.4.0 (newer than 4.1.0). I'll pin to the current published versions. Now writing the consolidated blueprint.

---

# Headache Diary — BUILD BLUEPRINT (Single Source of Truth)

A mobile-first Next.js 16 App Router PWA: premium 3D head (react-three-fiber v9 / React 19), local-first IndexedDB (Dexie) with Supabase multi-user sync + RLS, doctor-ready PDF/CSV/JSON export with any-language (Devanagari/Hinglish) support, and a deterministic ICHD-3 classification engine.

**Stack lock:** Next 16.2.9 · React 19.2.7 · Turbopack (default) · Tailwind v4 (CSS-first) · TypeScript 5.9 · R3F 9.6.1 / three 0.184.0 · @serwist/next 9.5.11 · @supabase/ssr 0.12.0 · Dexie 4.4.3 · Zod 4.4.3.

---

## 0. Version reconciliation (decisions you don't have to re-litigate)

| Concern | Decision | Reason |
|---|---|---|
| Next.js | **16.2.9** | Latest stable on npm (verified). `proxy.ts` replaces `middleware.ts`; Turbopack is default for dev+build; `next build` no longer lints; `next lint` removed. |
| React / react-dom | **19.2.7** (verified latest) | R3F v9.5.0+ bundles its own reconciler → works across React 19.0–19.2.x. Keep `react` and `react-dom` identical. App Router runs a React canary internally regardless. |
| R3F line | **@react-three/fiber 9.6.1** (NOT v8 = React 18; NOT v10 = alpha) | v9 is the React 19 line. |
| drei / three / @types/three | **10.7.7 / 0.184.0 / 0.184.1** | Pair with R3F v9 + React 19. |
| Tailwind | **v4** (`tailwindcss` + `@tailwindcss/postcss`) | CSS-first, no `tailwind.config.js`, no `content` array. |
| Session middleware | Next 16 → **`proxy.ts`** at root, exporting `proxy()`; logic in `src/lib/supabase/proxy.ts`. Node.js runtime only (edge unsupported). | Next 16 rename. |
| Supabase env keys | **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** (`sb_publishable_…`), **not** anon JWT. Server uses `sb_secret_…` (never shipped to browser). | 2026 key rename; legacy anon deprecated end-2026. |
| Auth helpers | **`@supabase/ssr` only.** Never install `@supabase/auth-helpers-nextjs` (EOL). | — |
| PDF for Hindi | **No jsPDF.** Browser print route + `window.print()`. | jsPDF can't shape Devanagari. |
| date-fns | **4.4.0** (verified latest) | tz-aware, ESM, tree-shakable. |
| zod | **4.4.3** | Root import `import { z } from 'zod'`. Engine boundary validation only. |

**The single biggest reconciliation** — the diary field set — is resolved in §6, and the SQL `entries` table (§5) is widened so it carries **every ICHD-3 engine input** plus the daily-UX fields. Dexie `Entry`, the SQL row, the ICHD-3 `DiaryAggregate`, and the report `DiaryEntry` are all derived from that one canonical schema.

---

## 1. Final `package.json`

```jsonc
{
  "name": "headache-diary",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "lint:fix": "eslint --fix",
    "typecheck": "tsc --noEmit",
    "db:push": "supabase db push"
  },
  "dependencies": {
    "next": "16.2.9",
    "react": "19.2.7",
    "react-dom": "19.2.7",

    "@react-three/fiber": "9.6.1",
    "@react-three/drei": "10.7.7",
    "three": "0.184.0",
    "three-mesh-bvh": "0.9.1",

    "@serwist/next": "9.5.11",

    "@supabase/ssr": "0.12.0",
    "@supabase/supabase-js": "2.108.1",
    "dexie": "4.4.3",
    "dexie-react-hooks": "4.4.3",

    "zustand": "5.0.8",
    "zod": "4.4.3",

    "papaparse": "5.5.3",
    "date-fns": "4.4.0"
  },
  "devDependencies": {
    "typescript": "5.9.3",
    "@types/node": "22.10.2",
    "@types/react": "19.2.2",
    "@types/react-dom": "19.2.1",
    "@types/three": "0.184.1",
    "@types/papaparse": "5.3.16",

    "serwist": "9.5.11",
    "supabase": "2.34.3",

    "tailwindcss": "4.1.18",
    "@tailwindcss/postcss": "4.1.18",

    "eslint": "9.39.0",
    "eslint-config-next": "16.2.9",
    "@eslint/eslintrc": "3.3.1"
  }
}
```

**Conflict notes baked in:**
- `react` / `react-dom` / `@types/react` / `@types/react-dom` all on the 19.2.x line; R3F 9.6.1's bundled reconciler removes the 19.1↔19.2 mismatch risk.
- `@serwist/next` (dep) and `serwist` (devDep) **must be identical** → both `9.5.11`.
- `dexie` and `dexie-react-hooks` **must match** → both `4.4.3`.
- `tailwindcss` and `@tailwindcss/postcss` **must match** → both `4.1.18`.
- `@react-three/gltfjsx` is **not** a dependency — it's a one-off `npx` dev tool (§2 step 8).
- `web-push` deliberately omitted (push notifications are out of scope; add only if you wire reminders).

---

## 2. Exact ordered build steps

1. **Preflight.** `node -v` ≥ 20.9. Confirm npm available.
2. **Scaffold** (non-interactive, from the parent dir):
   ```bash
   npx create-next-app@latest headache-diary \
     --ts --eslint --tailwind --app --src-dir \
     --import-alias "@/*" --turbopack --use-npm --no-agents-md --yes
   ```
   `--no-agents-md` because you manage your own CLAUDE.md.
3. **Pin deps.** Replace generated `package.json` deps/devDeps with §1, then `npm install`.
4. **Verify Tailwind v4 wiring.** `postcss.config.mjs` contains only `@tailwindcss/postcss`; `src/app/globals.css` starts with `@import "tailwindcss";`. No `tailwind.config.ts`. Write the `@theme` tokens (§4).
5. **Add `next.config.ts`** with Serwist wrapper + Turbopack key (§4).
6. **Add PWA scaffolding:** `src/app/manifest.ts`, `metadata`/`viewport` exports in `layout.tsx`, `src/app/sw.ts`, `src/app/~offline/page.tsx`. Patch `tsconfig.json` (Serwist types + webworker lib + exclude `public/sw.js`). Add `public/sw*` to `.gitignore`.
7. **Generate PWA icons** into `public/icons/`: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (purpose maskable), `apple-touch-icon.png` (180×180, opaque).
8. **3D head asset.** Drop `head.glb` in repo root, run:
   ```bash
   npx @react-three/gltfjsx@latest head.glb -t -T -o src/components/head/Head.gen.tsx
   ```
   Put the produced `head-transformed.glb` in `public/`. Note the real mesh node name from the generated file and wire it into `HeadModel.tsx`.
9. **Supabase clients + auth.** Create `src/lib/supabase/{client,server,proxy}.ts`, root `proxy.ts`, `src/app/login/`, `src/app/auth/confirm/route.ts`. Add `.env.local`.
10. **Local-first data layer.** Create `src/lib/db/index.ts` (Dexie) and `src/lib/db/sync.ts` (Supabase sync).
11. **ICHD-3 engine.** Create `src/lib/ichd3/{model,engine}.ts` + `inputs.md`. Create the adapter `src/lib/ichd3/aggregate.ts` that derives `DiaryAggregate` from stored `Entry[]`.
12. **Report/export.** Create `src/lib/report/{types,build,download}.ts`, `src/app/report/page.tsx`, `src/app/report/print/page.tsx`, `src/app/report/print/print.css`, `src/app/report/print/layout.tsx`.
13. **App shell + diary UI.** Build `src/app/layout.tsx`, `src/app/page.tsx` (today + 3D head), `src/app/history/page.tsx`, components, Zustand store.
14. **SQL migration.** `supabase/migrations/0001_entries.sql` (§5).
15. **Lint + typecheck.** `npm run lint && npm run typecheck`.
16. **PWA/offline QA.** `npm run build && npm run start` over HTTPS; DevTools → Application → Manifest/Service Workers; Lighthouse PWA audit.
17. **Print QA.** Print preview in Chrome + Firefox with one Hindi note (`सुबह तेज़ सिरदर्द, दाईं तरफ`) and one Hinglish note; open the CSV in Excel/Sheets to confirm BOM works.
18. **Provision + deploy** (§7).

---

## 3. Complete file manifest

```
headache-diary/
├─ next.config.ts                         # Next + Serwist PWA wrapper; Turbopack key
├─ postcss.config.mjs                      # Tailwind v4 PostCSS plugin (only)
├─ tsconfig.json                           # paths @/*→src; Serwist types; webworker lib
├─ eslint.config.mjs                       # Next flat config
├─ proxy.ts                                # ROOT: Next16 session refresh (calls updateSession)
├─ .env.local                             # Supabase URL + publishable key (local)
├─ .gitignore                             # + public/sw* public/swe-worker*
├─ supabase/
│  ├─ config.toml                          # supabase init output
│  └─ migrations/
│     └─ 0001_entries.sql                  # FULL schema + RLS (§5)
├─ public/
│  ├─ head-transformed.glb                 # compressed 3D head (gltfjsx -T output)
│  └─ icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png
└─ src/
   ├─ app/
   │  ├─ layout.tsx                        # root <html>; metadata+viewport (PWA/Apple meta); theme
   │  ├─ globals.css                       # @import "tailwindcss" + @theme + safe-area base
   │  ├─ manifest.ts                       # MetadataRoute.Manifest
   │  ├─ sw.ts                             # Serwist service worker source (compiles → public/sw.js)
   │  ├─ ~offline/page.tsx                 # offline navigation fallback (force-static)
   │  ├─ page.tsx                          # MAIN SHELL: today's entry + 3D head + save
   │  ├─ history/page.tsx                  # past entries list (useLiveQuery)
   │  ├─ login/page.tsx                    # login route (server) renders LoginForm
   │  ├─ login/login-form.tsx             # 'use client' magic-link form
   │  ├─ auth/confirm/route.ts             # GET: verifyOtp → set session cookie → redirect
   │  ├─ auth/auth-code-error/page.tsx     # auth failure landing
   │  ├─ report/page.tsx                   # date-range picker + CSV/JSON/Print buttons
   │  └─ report/print/
   │     ├─ layout.tsx                     # minimal layout (no app chrome) for print
   │     ├─ page.tsx                       # 'use client' print page → window.print()
   │     └─ print.css                      # @page A4 + print rules + Devanagari font stack
   ├─ components/
   │  ├─ head/
   │  │  ├─ HeadScene.tsx                  # 'use client' <Canvas>, lights, env, controls
   │  │  ├─ HeadModel.tsx                  # head mesh, tap-vs-drag, local-space classify
   │  │  ├─ Head.gen.tsx                   # gltfjsx-generated typed model (reference)
   │  │  ├─ Markers.tsx                    # emissive heat-colored pain markers
   │  │  ├─ regions.ts                     # 16 region centroids + nearest-centroid classify
   │  │  └─ heat.ts                        # 0-10 → green→red color ramp
   │  ├─ diary/
   │  │  ├─ EntryForm.tsx                  # 'use client' full diary form (binds the field set)
   │  │  ├─ PainScale.tsx                  # 0-10 intensity slider
   │  │  └─ SymptomChips.tsx              # multi-select chips for symptom arrays
   │  └─ ui/
   │     ├─ BottomNav.tsx                  # mobile tab bar (hidden in @media print)
   │     ├─ InstallHint.tsx               # iOS "Add to Home Screen" hint
   │     └─ DateRangePicker.tsx
   ├─ lib/
   │  ├─ supabase/
   │  │  ├─ client.ts                      # createBrowserClient
   │  │  ├─ server.ts                      # createServerClient (awaits cookies())
   │  │  └─ proxy.ts                       # updateSession() session-refresh logic
   │  ├─ db/
   │  │  ├─ index.ts                       # Dexie DiaryDB + Entry type (canonical)
   │  │  └─ sync.ts                        # saveEntry / pushDirty / pullAndMerge (LWW)
   │  ├─ ichd3/
   │  │  ├─ model.ts                       # Zod DiaryAggregate / AttackProfile
   │  │  ├─ engine.ts                      # 10 dx functions + classify() + hierarchy
   │  │  ├─ aggregate.ts                   # Entry[] → DiaryAggregate adapter
   │  │  └─ inputs.md                      # field→criterion documentation
   │  └─ report/
   │     ├─ types.ts                       # DiaryEntry / ReportRow / DateRange
   │     ├─ build.ts                       # filterByRange / buildReportRows / summarize
   │     └─ download.ts                    # CSV(+BOM) / JSON download helpers
   ├─ store/
   │  └─ entry-store.ts                    # Zustand: current-entry draft + settings
   └─ types/
      └─ entry.ts                          # shared field-set constants (symptom option lists)
```

---

## 4. Key configuration & PWA files

### `next.config.ts` (Next + Serwist + Turbopack, mutually consistent)

```ts
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: false, // don't force-refresh mid-entry
  disable: process.env.NODE_ENV === "development", // avoid stale-cache in dev
});

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next 16 (dev + build).
  turbopack: {}, // add turbopack.rules only for raw-loading GLB if ever needed
};

export default withSerwist(nextConfig);
```

> Serwist bundles the SW with webpack internally; the app itself builds with Turbopack. QA offline against a production build (`next build && next start`), not dev.

### `postcss.config.mjs`

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

### `src/app/globals.css`

```css
@import "tailwindcss";

/* Class-based dark mode (manual toggle) */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-pain-0: oklch(0.95 0.02 150);
  --color-pain-5: oklch(0.80 0.16 70);
  --color-pain-10: oklch(0.62 0.24 25);
  --color-brand: oklch(0.55 0.18 265);
  --font-sans: var(--font-geist-sans), "Noto Sans Devanagari", ui-sans-serif, system-ui, sans-serif;
  --breakpoint-xs: 22rem;
}

@layer base {
  html, body {
    height: 100%;
    overscroll-behavior-y: none;
  }
  body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

### `tsconfig.json` (merged: scaffold + Serwist)

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["esnext", "dom", "dom.iterable", "webworker"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "types": ["@serwist/next/typings"],
    "plugins": [{ "name": "next" }],
    "baseUrl": "src",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "public/sw.js"]
}
```

### `eslint.config.mjs`

```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [...compat.extends("next/core-web-vitals", "next/typescript")];
export default eslintConfig;
```

### `src/app/manifest.ts`

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Headache Diary",
    short_name: "Headache",
    description: "Track headache & migraine pain, get doctor-ready ICHD-3 reports.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0f",
    theme_color: "#0b0b0f",
    categories: ["health", "medical", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

### `src/app/sw.ts` (service worker source)

```ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, CacheFirst, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => /\.(?:glb|gltf|bin|hdr|ktx2)$/i.test(url.pathname),
      handler: new CacheFirst({ cacheName: "3d-assets" }),
    },
    {
      matcher: ({ url }) => url.hostname.endsWith(".supabase.co"),
      handler: new NetworkFirst({ cacheName: "supabase", networkTimeoutSeconds: 5 }),
    },
    {
      matcher: ({ request }) => request.destination === "font" || request.destination === "image",
      handler: new StaleWhileRevalidate({ cacheName: "static-media" }),
    },
    ...defaultCache, // spread LAST so custom matchers win
  ],
  fallbacks: {
    entries: [
      { url: "/~offline", matcher: ({ request }) => request.destination === "document" },
    ],
  },
});

serwist.addEventListeners();
```

> User diary data lives in IndexedDB, **never** the SW cache. The SW only caches app shell, static assets, the GLB, and acts as a NetworkFirst fallback for Supabase sync.

### `src/app/~offline/page.tsx`

```tsx
export const dynamic = "force-static";

export default function Offline() {
  return (
    <main className="grid h-dvh place-items-center p-6 text-center">
      <div>
        <h1 className="text-lg font-semibold">You’re offline</h1>
        <p className="mt-2 text-sm opacity-70">
          Headache Diary works offline. Your entries are saved on this device and sync when you’re back online.
        </p>
      </div>
    </main>
  );
}
```

---

## 5. COMPLETE SQL migration — `supabase/migrations/0001_entries.sql`

This is the reconciled, authoritative schema. The `entries` table carries **every ICHD-3 engine input** plus daily-UX fields. The 3D pain locations live in `regions` (jsonb). Aura/autonomic/cervicogenic/aggregate fields are explicit columns so the engine reads them directly. Clinical-test fields default to "not tested" so the engine returns `NEEDS_TEST` rather than fabricating positives.

```sql
-- ============================================================
-- Headache Diary — entries schema + RLS
-- One row per (user_id, date). Carries daily UX + ICHD-3 inputs.
-- ============================================================

create extension if not exists pgcrypto; -- gen_random_uuid()

create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,

  -- ---- daily UX top-level ----
  no_headache boolean not null default false,
  worst       smallint not null default 0,          -- 0-10 worst intensity of day

  -- ---- 3D head pain locations (one mark per tap) ----
  -- [{ regionId, regionLabel, intensity, local:[x,y,z], world:[x,y,z], ts }]
  regions     jsonb not null default '[]'::jsonb,

  -- ---- ATTACK-LEVEL (modal/typical attack profile) ----
  duration_hours       real,                          -- typical untreated duration (h)
  min_duration_hours   real,                          -- shortest qualifying attack (h)
  max_duration_hours   real,                          -- longest qualifying attack (h)
  laterality           text check (laterality in ('unilateral','bilateral')),
  side_locked          boolean not null default false,
  quality              text check (quality in ('pulsating','pressing_tightening','stabbing','other')),
  intensity            smallint check (intensity between 0 and 10), -- attack intensity 0-10
  aggravated_by_activity boolean not null default false,
  nausea               text not null default 'none'
                         check (nausea in ('none','mild','moderate','severe')),
  vomiting             boolean not null default false,
  photophobia          boolean not null default false,
  phonophobia          boolean not null default false,
  -- ('orbital'|'supraorbital'|'temporal'|'frontal'|'occipital'|'whole_head')
  pain_regions         text[] not null default '{}',

  -- ---- AURA (1.2) ----
  aura                       boolean not null default false,
  aura_types                 text[] not null default '{}', -- visual|sensory|speech_language|motor|brainstem|retinal
  aura_fully_reversible      boolean not null default false,
  aura_spreads_over_5min     boolean not null default false,
  aura_symptoms_in_succession boolean not null default false,
  aura_each_5to60min         boolean not null default false,
  aura_at_least_one_unilateral boolean not null default false,
  aura_at_least_one_positive boolean not null default false,
  aura_followed_by_headache_60min boolean not null default false,

  -- ---- AUTONOMIC / TAC (3.1/3.2/3.4), ipsilateral ----
  conjunctival_injection_or_lacrimation boolean not null default false,
  nasal_congestion_or_rhinorrhoea       boolean not null default false,
  eyelid_oedema                         boolean not null default false,
  forehead_facial_sweating              boolean not null default false,
  miosis_or_ptosis                      boolean not null default false,
  restlessness_or_agitation             boolean not null default false,

  -- ---- CERVICOGENIC provocation (11.2.1) ----
  neck_range_of_motion_reduced     boolean not null default false,
  headache_worsened_by_neck_manoeuvres boolean not null default false,

  -- ---- MONTHLY / COURSE AGGREGATES (derived; stored snapshot per entry) ----
  distinct_attack_count      integer not null default 0,
  headache_days_per_month    smallint not null default 0,
  migrainous_days_per_month  smallint not null default 0,
  observation_months         real not null default 0,
  attack_frequency_per_day   real not null default 0,
  bout_pattern               text not null default 'unknown'
                               check (bout_pattern in ('episodic','chronic','unknown')),
  onset_pattern              text not null default 'unknown'
                               check (onset_pattern in ('daily_unremitting_from_onset_within_24h','gradual','unknown')),

  -- ---- MEDICATION OVERUSE (8.2) ----
  acute_med_days_per_month   smallint not null default 0,
  med_class                  text not null default 'none'
                               check (med_class in ('ergotamine','triptan','opioid','combination_analgesic','simple_nonopioid','multiple_not_individually','none')),
  pre_existing_primary_headache boolean not null default false,
  meds                       text[] not null default '{}',     -- free list of meds taken (UX)
  meds_other                 text,                              -- any-language free text

  -- ---- CLINICAL-TEST inputs (NEVER inferred; drive NEEDS_TEST) ----
  indomethacin_response      text not null default 'not_tested'
                               check (indomethacin_response in ('absolute','partial','none','not_tested')),
  cervical_imaging_or_clinical_evidence boolean not null default false,
  nerve_block_abolishes_headache text not null default 'not_tested'
                               check (nerve_block_abolishes_headache in ('yes','no','not_tested')),

  -- ---- EXCLUSION (clinician-set) ----
  better_accounted_by_other_dx boolean not null default false,

  -- ---- free-text note, any language (UTF-8) ----
  note        text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, date)
);

create index if not exists entries_user_updated_idx
  on public.entries (user_id, updated_at desc);

-- auto-touch updated_at server-side
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists entries_touch_updated_at on public.entries;
create trigger entries_touch_updated_at
  before update on public.entries
  for each row execute function public.touch_updated_at();

-- ============================ RLS ============================
alter table public.entries enable row level security;

create policy "entries_select_own" on public.entries
  for select to authenticated
  using ( (select auth.uid()) = user_id );

create policy "entries_insert_own" on public.entries
  for insert to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "entries_update_own" on public.entries
  for update to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy "entries_delete_own" on public.entries
  for delete to authenticated
  using ( (select auth.uid()) = user_id );
```

Notes that matter: `(select auth.uid())` (subquery form) is initPlan-cached (per-statement, not per-row). `to authenticated` denies anon. `unique(user_id,date)` → upserts must pass `onConflict:'user_id,date'`. The `updated_at` trigger guarantees server-side monotonic `updated_at` for LWW sync. All text/text[]/jsonb is UTF-8 → Devanagari/Hinglish notes need no special handling.

---

## 6. THE FINAL DIARY FIELD SET (one canonical list)

This list is the union that satisfies daily UX **and** all 10 ICHD-3 diagnoses. It maps 1:1 to the SQL columns (§5), the Dexie `Entry` (§4 lib/db), and `DiaryAggregate` (§ ICHD-3). Source-of-truth ordering: identity → daily → attack → aura → autonomic → cervicogenic → monthly aggregates → meds → clinical tests → exclusion → note.

| # | Field (camelCase / DB snake_case) | Type | Daily UX surface | ICHD-3 use |
|---|---|---|---|---|
| 1 | `id` | uuid (client-generated) | — | row key |
| 2 | `userId` / `user_id` | uuid? | — | RLS / sync |
| 3 | `date` | YYYY-MM-DD | date picker | observation window |
| 4 | `noHeadache` / `no_headache` | bool | "No headache today" toggle | excludes from counts |
| 5 | `worst` | 0-10 | day-level slider | report summary |
| 6 | `regions` | jsonb mark[] | 3D head taps (regionId,intensity,local,world,ts) | pain location → region set |
| 7 | `durationHours` | number | "how long (typical)" | all duration criteria |
| 8 | `minDurationHours` | number | derived/min | MwoA 4–72h, TTH 30min–7d, cluster/PH min |
| 9 | `maxDurationHours` | number | derived/max | duration ceilings |
| 10 | `laterality` | unilateral/bilateral | toggle | MwoA C, TTH C, cluster/PH/HC |
| 11 | `sideLocked` / `side_locked` | bool | "always same side?" | cervicogenic/TAC signal |
| 12 | `quality` | pulsating/pressing_tightening/stabbing/other | chips | MwoA C, TTH C |
| 13 | `intensity` | 0-10 | attack slider → band | moderate/severe gates |
| 14 | `aggravatedByActivity` | bool | toggle | MwoA C, TTH C(inverse) |
| 15 | `nausea` | none/mild/moderate/severe | chips | MwoA D, TTH D |
| 16 | `vomiting` | bool | toggle | MwoA D, TTH D |
| 17 | `photophobia` | bool | toggle | MwoA D, TTH D |
| 18 | `phonophobia` | bool | toggle | MwoA D, TTH D |
| 19 | `painRegions` / `pain_regions` | text[] | derived from 3D taps | TAC region gate |
| 20 | `aura` | bool | "any aura?" | MwA A |
| 21 | `auraTypes` | text[] | chips | MwA B |
| 22 | `auraFullyReversible` | bool | toggle | MwA B |
| 23 | `auraSpreadsOver5min` | bool | toggle | MwA C |
| 24 | `auraSymptomsInSuccession` | bool | toggle | MwA C |
| 25 | `auraEach5to60min` | bool | toggle | MwA C |
| 26 | `auraAtLeastOneUnilateral` | bool | toggle | MwA C |
| 27 | `auraAtLeastOnePositive` | bool | toggle | MwA C |
| 28 | `auraFollowedByHeadache60min` | bool | toggle | MwA C |
| 29 | `conjunctivalInjectionOrLacrimation` | bool | autonomic chips | cluster/PH/HC C |
| 30 | `nasalCongestionOrRhinorrhoea` | bool | autonomic chips | cluster/PH/HC C |
| 31 | `eyelidOedema` | bool | autonomic chips | cluster/PH/HC C |
| 32 | `foreheadFacialSweating` | bool | autonomic chips | cluster/PH/HC C |
| 33 | `miosisOrPtosis` | bool | autonomic chips | cluster/PH/HC C |
| 34 | `restlessnessOrAgitation` | bool | toggle | cluster/PH C |
| 35 | `neckRangeOfMotionReduced` | bool | toggle | cervicogenic C3 |
| 36 | `headacheWorsenedByNeckManoeuvres` | bool | toggle | cervicogenic C3 |
| 37 | `distinctAttackCount` | int | derived (settings/history) | ≥5/≥2/≥20/≥10 gates |
| 38 | `headacheDaysPerMonth` | int | derived | CM A, CTTH, MOH A |
| 39 | `migrainousDaysPerMonth` | int | derived | CM C (≥8) |
| 40 | `observationMonths` | number | derived | all ">3 months" |
| 41 | `attackFrequencyPerDay` | number | derived | cluster D, PH D |
| 42 | `boutPattern` | episodic/chronic/unknown | derived | episodic vs chronic |
| 43 | `onsetPattern` | daily_unremitting…/gradual/unknown | "sudden daily onset?" | NDPH B (deciding field) |
| 44 | `acuteMedDaysPerMonth` | int | derived from `meds` logging | MOH B |
| 45 | `medClass` | enum (7) | chips | MOH threshold select |
| 46 | `preExistingPrimaryHeadache` | bool | settings | MOH A |
| 47 | `meds` | text[] | meds chips | UX / MOH-day derivation |
| 48 | `medsOther` / `meds_other` | text (any lang) | free text | UX |
| 49 | `indomethacinResponse` | absolute/partial/none/not_tested | clinician/settings | PH E, HC D (NEEDS_TEST) |
| 50 | `cervicalImagingOrClinicalEvidence` | bool | clinician/settings | cervicogenic B |
| 51 | `nerveBlockAbolishesHeadache` | yes/no/not_tested | clinician/settings | cervicogenic C4 |
| 52 | `betterAccountedByOtherDx` | bool | clinician/settings | every dx final criterion |
| 53 | `note` | text (any lang) | free text | UX (never read by engine) |
| 54 | `createdAt` / `updatedAt` | ISO | — | sync merge key |
| 55 | `_dirty` | 0\|1 (Dexie only) | — | sync push flag |

Fields #37–42, #44 are **derived aggregates** computed by `src/lib/ichd3/aggregate.ts` from the full `Entry[]` history at report time; they're also snapshotted per-entry in SQL so the doctor report is reproducible. Fields #49–52 default to "not tested/false" → engine returns `NEEDS_TEST`, never a fabricated positive.

---

## 7. Key code for important files

### `src/lib/supabase/client.ts`

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

### `src/lib/supabase/server.ts`

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — ignore; proxy refreshes the cookie.
          }
        },
      },
    }
  );
}
```

### `src/lib/supabase/proxy.ts` (session-refresh logic)

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do NOT run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // MUST return supabaseResponse unmodified or sessions desync.
  return supabaseResponse;
}
```

### `proxy.ts` (project root — Next 16)

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb)$).*)",
  ],
};
```

> On Next 15 only: rename this file `middleware.ts` and export `middleware`. Body identical. The matcher also excludes `sw.js`, the manifest, and `.glb` so the SW/PWA assets are never gated by auth.

### `src/app/auth/confirm/route.ts`

```ts
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) redirect(next);
  }
  redirect("/auth/auth-code-error");
}
```

> Set the Supabase email template link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` and allow-list `${origin}/auth/confirm`.

### `src/app/login/login-form.tsx`

```tsx
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) return <p className="p-6 text-sm">Check your email for the sign-in link.</p>;
  return (
    <form onSubmit={signIn} className="mx-auto max-w-sm space-y-3 p-6">
      <input
        type="email" inputMode="email" autoComplete="email" required
        value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border px-3 py-2" placeholder="you@example.com"
      />
      <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white">
        Send magic link
      </button>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
```

### `src/components/head/HeadScene.tsx`

```tsx
"use client";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls, Environment, ContactShadows, Bvh, AdaptiveDpr,
  PerformanceMonitor, useGLTF,
} from "@react-three/drei";
import { useState, Suspense } from "react";
import { HeadModel } from "./HeadModel";
import { Markers, type PainMark } from "./Markers";

export default function HeadScene({
  intensity, marks, onPlace,
}: {
  intensity: number;
  marks: PainMark[];
  onPlace: (m: PainMark) => void;
}) {
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas
      shadows
      dpr={[1, dpr]}
      camera={{ position: [0, 0, 2.6], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} />
      <color attach="background" args={["#0b0b10"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={1.4} castShadow />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#88aaff" />
      <Suspense fallback={null}>
        <Bvh firstHitOnly>
          <HeadModel intensity={intensity} onPlace={onPlace} />
        </Bvh>
        <Markers marks={marks} />
        <Environment preset="studio" />
      </Suspense>
      <ContactShadows position={[0, -0.85, 0]} opacity={0.5} scale={5} blur={2.6} far={1.5} />
      <OrbitControls makeDefault enablePan={false} enableDamping minDistance={1.8} maxDistance={4} />
      <AdaptiveDpr pixelated />
    </Canvas>
  );
}
useGLTF.preload("/head-transformed.glb");
```

> `HeadScene` is consumed via `next/dynamic({ ssr:false })` from the diary surface — three.js touches WebGL/window and must never SSR.

### `src/components/head/HeadModel.tsx`

```tsx
"use client";
import { useGLTF } from "@react-three/drei";
import { useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { classifyRegion } from "./regions";
import { heatColor } from "./heat";
import type { PainMark } from "./Markers";

const TAP_PX = 8;
const TAP_MS = 300;

export function HeadModel({
  intensity, onPlace,
}: { intensity: number; onPlace: (m: PainMark) => void }) {
  const { nodes } = useGLTF("/head-transformed.glb") as any;
  const down = useRef<{ x: number; y: number; t: number } | null>(null);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, t: performance.now() };
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const d = down.current; down.current = null;
    if (!d) return;
    const moved = Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y);
    const elapsed = performance.now() - d.t;
    if (moved > TAP_PX || elapsed > TAP_MS) return; // rotate/drag, not a tap

    // World hit → LOCAL space (rotation/scale invariant) for stable classification
    const localPoint = e.point.clone().applyMatrix4(e.object.matrixWorld.clone().invert());
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

  // Replace HeadMesh with the real node name from Head.gen.tsx.
  const headGeom =
    (nodes.HeadMesh ?? Object.values(nodes).find((n: any) => n.isMesh)).geometry;

  return (
    <group>
      <mesh
        geometry={headGeom}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        castShadow receiveShadow
      >
        <meshPhysicalMaterial color="#e8b58f" roughness={0.62} clearcoat={0} sheen={0.4} sheenColor="#ffd9c2" />
      </mesh>
      {nodes.Brain && (
        <mesh geometry={nodes.Brain.geometry} renderOrder={1}>
          <meshPhysicalMaterial color="#ff9bb0" transparent opacity={0.15} depthWrite={false} roughness={0.4} />
        </mesh>
      )}
    </group>
  );
}
```

`src/components/head/regions.ts` (16 centroids + nearest-centroid `classifyRegion`), `heat.ts` (0-10 green→red ramp), and `Markers.tsx` (emissive spheres, `toneMapped={false}`) are used verbatim from the 3d-head blueprint. **Calibrate `REGION_CENTROIDS` once** against your actual GLB by logging `localPoint` while tapping each region in dev, then hardcode — the snippet values are illustrative.

### `src/lib/db/index.ts` (Dexie — local source of truth)

The `Entry` interface mirrors §6/§5 exactly. Index booleans as `0/1`; generate `id` client-side so upserts are deterministic.

```ts
import Dexie, { type Table } from "dexie";

export interface PainMark {
  id: string; regionId: string; regionLabel: string; intensity: number;
  color: string; local: [number, number, number]; world: [number, number, number]; ts: number;
}

export interface Entry {
  id: string;
  user_id: string | null;
  date: string;                 // YYYY-MM-DD
  no_headache: boolean;
  worst: number;                // 0-10
  regions: PainMark[];

  // attack profile
  duration_hours?: number;
  min_duration_hours?: number;
  max_duration_hours?: number;
  laterality?: "unilateral" | "bilateral";
  side_locked: boolean;
  quality?: "pulsating" | "pressing_tightening" | "stabbing" | "other";
  intensity?: number;
  aggravated_by_activity: boolean;
  nausea: "none" | "mild" | "moderate" | "severe";
  vomiting: boolean;
  photophobia: boolean;
  phonophobia: boolean;
  pain_regions: string[];

  // aura
  aura: boolean;
  aura_types: string[];
  aura_fully_reversible: boolean;
  aura_spreads_over_5min: boolean;
  aura_symptoms_in_succession: boolean;
  aura_each_5to60min: boolean;
  aura_at_least_one_unilateral: boolean;
  aura_at_least_one_positive: boolean;
  aura_followed_by_headache_60min: boolean;

  // autonomic
  conjunctival_injection_or_lacrimation: boolean;
  nasal_congestion_or_rhinorrhoea: boolean;
  eyelid_oedema: boolean;
  forehead_facial_sweating: boolean;
  miosis_or_ptosis: boolean;
  restlessness_or_agitation: boolean;

  // cervicogenic
  neck_range_of_motion_reduced: boolean;
  headache_worsened_by_neck_manoeuvres: boolean;

  // aggregates (snapshot)
  distinct_attack_count: number;
  headache_days_per_month: number;
  migrainous_days_per_month: number;
  observation_months: number;
  attack_frequency_per_day: number;
  bout_pattern: "episodic" | "chronic" | "unknown";
  onset_pattern: "daily_unremitting_from_onset_within_24h" | "gradual" | "unknown";

  // medication overuse
  acute_med_days_per_month: number;
  med_class: "ergotamine" | "triptan" | "opioid" | "combination_analgesic" | "simple_nonopioid" | "multiple_not_individually" | "none";
  pre_existing_primary_headache: boolean;
  meds: string[];
  meds_other?: string;

  // clinical tests
  indomethacin_response: "absolute" | "partial" | "none" | "not_tested";
  cervical_imaging_or_clinical_evidence: boolean;
  nerve_block_abolishes_headache: "yes" | "no" | "not_tested";

  better_accounted_by_other_dx: boolean;
  note?: string;

  created_at: string;
  updated_at: string;
  _dirty?: 0 | 1;
}

export class DiaryDB extends Dexie {
  entries!: Table<Entry, string>;
  constructor() {
    super("headache-diary");
    this.version(1).stores({
      entries: "id, date, updated_at, _dirty",
    });
  }
}
export const db = new DiaryDB();
```

### `src/lib/db/sync.ts` (local-first LWW sync)

```ts
import { db, type Entry } from "./index";
import { createClient } from "@/lib/supabase/client";

export async function saveEntry(e: Entry) {
  e.updated_at = new Date().toISOString();
  e._dirty = 1;
  await db.entries.put(e);
  if (navigator.onLine) void pushDirty();
}

export async function pushDirty() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const dirty = await db.entries.where("_dirty").equals(1).toArray();
  for (const row of dirty) {
    const { _dirty, ...payload } = { ...row, user_id: user.id };
    const { error } = await supabase
      .from("entries")
      .upsert(payload, { onConflict: "user_id,date" });
    if (!error) await db.entries.update(row.id, { _dirty: 0, user_id: user.id });
  }
}

export async function pullAndMerge() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: remote, error } = await supabase
    .from("entries").select("*").eq("user_id", user.id);
  if (error || !remote) return;
  await db.transaction("rw", db.entries, async () => {
    for (const r of remote as Entry[]) {
      const local = await db.entries.get(r.id);
      if (!local || new Date(r.updated_at) > new Date(local.updated_at)) {
        await db.entries.put({ ...r, _dirty: 0 });
      }
    }
  });
  await pushDirty();
}

// Call once at app start: window.addEventListener("online", () => void pushDirty());
```

### `src/lib/ichd3/model.ts` and `engine.ts`

Use the ichd3-engine blueprint **verbatim** for `model.ts` (Zod `AttackProfile` + `DiaryAggregate`, `z.infer`) and `engine.ts` (the 10 dx functions `migraineWithoutAura`, `migraineWithAura`, `chronicMigraine`, `tensionType`, `clusterHeadache`, `paroxysmalHemicrania`, `hemicraniaContinua`, `medicationOveruse`, `ndph`, `cervicogenic`, plus `classify()` with the hierarchy post-pass). Key invariants preserved: PH crit E / HC crit D / cervicogenic B+C4 cap at `NEEDS_TEST`; MOH threshold = 15 for `simple_nonopioid` else 10; CM suppresses CTTH; NDPH precedence; CM+MOH both reported. Add the bridge:

### `src/lib/ichd3/aggregate.ts` (Entry[] → DiaryAggregate)

```ts
import type { Entry } from "@/lib/db";
import { DiaryAggregate } from "./model";
import { classify } from "./engine";

/** Build the engine input from the full entry history + the modal/typical attack. */
export function toAggregate(entries: Entry[]) {
  const headacheDays = entries.filter((e) => !e.no_headache);
  // pick the most recent headache day as the modal attack carrier (or merge as you prefer)
  const modal = headacheDays[headacheDays.length - 1];
  if (!modal) return null;

  const input = {
    attack: {
      typicalDurationHours: modal.duration_hours ?? 0,
      minDurationHours: modal.min_duration_hours ?? modal.duration_hours ?? 0,
      maxDurationHours: modal.max_duration_hours ?? modal.duration_hours ?? 0,
      laterality: modal.laterality ?? "bilateral",
      sideLocked: modal.side_locked,
      quality: modal.quality ?? "other",
      intensity0to10: modal.intensity ?? modal.worst,
      aggravatedByRoutineActivity: modal.aggravated_by_activity,
      nausea: modal.nausea,
      vomiting: modal.vomiting,
      photophobia: modal.photophobia,
      phonophobia: modal.phonophobia,
      painRegions: modal.pain_regions,
      auraPresent: modal.aura,
      auraTypes: modal.aura_types,
      auraFullyReversible: modal.aura_fully_reversible,
      auraSpreadsOver5min: modal.aura_spreads_over_5min,
      auraSymptomsInSuccession: modal.aura_symptoms_in_succession,
      auraEachSymptom5to60min: modal.aura_each_5to60min,
      auraAtLeastOneUnilateral: modal.aura_at_least_one_unilateral,
      auraAtLeastOnePositive: modal.aura_at_least_one_positive,
      auraFollowedByHeadacheWithin60min: modal.aura_followed_by_headache_60min,
      conjunctivalInjectionOrLacrimation: modal.conjunctival_injection_or_lacrimation,
      nasalCongestionOrRhinorrhoea: modal.nasal_congestion_or_rhinorrhoea,
      eyelidOedema: modal.eyelid_oedema,
      foreheadFacialSweating: modal.forehead_facial_sweating,
      miosisOrPtosis: modal.miosis_or_ptosis,
      restlessnessOrAgitation: modal.restlessness_or_agitation,
      neckRangeOfMotionReduced: modal.neck_range_of_motion_reduced,
      headacheWorsenedByNeckManoeuvres: modal.headache_worsened_by_neck_manoeuvres,
    },
    distinctAttackCount: modal.distinct_attack_count,
    headacheDaysPerMonth: modal.headache_days_per_month,
    migrainousDaysPerMonth: modal.migrainous_days_per_month,
    observationMonths: modal.observation_months,
    attackFrequencyPerDay: modal.attack_frequency_per_day,
    boutPattern: modal.bout_pattern,
    onsetPattern: modal.onset_pattern,
    acuteMedDaysPerMonth: modal.acute_med_days_per_month,
    medClass: modal.med_class,
    preExistingPrimaryHeadache: modal.pre_existing_primary_headache,
    indomethacinResponse: modal.indomethacin_response,
    cervicalImagingOrClinicalEvidence: modal.cervical_imaging_or_clinical_evidence,
    nerveBlockAbolishesHeadache: modal.nerve_block_abolishes_headache,
    betterAccountedByOtherDx: modal.better_accounted_by_other_dx,
  };

  DiaryAggregate.parse(input); // validate boundary
  return classify(input);      // DxResult[]
}
```

### `src/lib/report/build.ts` & `download.ts`

Use the export-i18n blueprint verbatim for `types.ts`, `build.ts` (`filterByRange`/`buildReportRows`/`summarize`, date-fns v4), and `download.ts` (`downloadCSV` with the U+FEFF BOM, `downloadJSON` without BOM, native anchor download with 1.5s `revokeObjectURL` delay). One reconciliation: `loadEntries()`/`loadRange()`/`saveRange()` referenced by the report pages live in `src/lib/db/index.ts` — `loadEntries` = `db.entries.toArray()`; range helpers use `localStorage`.

### `src/app/report/print/page.tsx` (print route) and `print.css`

Use the export-i18n print page verbatim (`"use client"`, `useEffect` registers `afterprint`→`router.back()`, fires `window.print()` on the next animation frame after rows load, renders A4 HTML with summary + inline trend bars + table + ICHD-3 section, `lang="hi"`). Wire the ICHD-3 section to render real `DxResult[]` from `toAggregate(await loadEntries())` instead of the placeholder, printing per-dx **code + verdict + passed/failed criterion lines + missing list + the NEEDS_TEST note + the decision-support disclaimer**. Use `print.css` verbatim (`@page A4`, `display:table-header-group`, `break-inside:avoid`, visibility trick, `'Noto Sans Devanagari'` font stack). Add `src/app/report/print/layout.tsx` returning a minimal `<html lang="hi"><body>{children}</body></html>` shell so the bottom nav never leaks into print.

### `src/app/layout.tsx` (root — PWA + Apple meta + theme)

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/ui/BottomNav";

export const metadata: Metadata = {
  applicationName: "Headache Diary",
  title: { default: "Headache Diary", template: "%s — Headache Diary" },
  description: "Track headache & migraine pain, get doctor-ready ICHD-3 reports.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Headache" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
```

### `src/app/page.tsx` (main app shell — today's entry + 3D head)

```tsx
"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { PainMark } from "@/components/head/Markers";
import { PainScale } from "@/components/diary/PainScale";
import { EntryForm } from "@/components/diary/EntryForm";
import { saveEntry, pullAndMerge, pushDirty } from "@/lib/db/sync";

// three.js MUST NOT SSR.
const HeadScene = dynamic(() => import("@/components/head/HeadScene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[55dvh] place-items-center text-sm opacity-60">Loading 3D head…</div>
  ),
});

export default function Home() {
  const [intensity, setIntensity] = useState(5);
  const [marks, setMarks] = useState<PainMark[]>([]);

  useEffect(() => {
    void pullAndMerge();
    const onOnline = () => void pushDirty();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col pb-20">
      <header className="px-4 pt-4">
        <h1 className="text-lg font-semibold">Today</h1>
        <p className="text-sm opacity-60">Tap the head where it hurts.</p>
      </header>

      <section className="h-[55dvh] w-full touch-none">
        <HeadScene intensity={intensity} marks={marks} onPlace={(m) => setMarks((p) => [...p, m])} />
      </section>

      <section className="px-4">
        <PainScale value={intensity} onChange={setIntensity} />
        <EntryForm
          marks={marks}
          onSave={(entry) => saveEntry(entry)}
        />
      </section>
    </main>
  );
}
```

> `EntryForm` binds the full §6 field set into an `Entry`, defaulting clinical-test fields to `not_tested`/`false`, stamps `created_at`/`updated_at`, generates `id` via `crypto.randomUUID()`, and calls `saveEntry`.

---

## 8. HUMAN / AUTOMATED SETUP STEPS

Legend: 🔑 = needs a browser login or a token you paste; 🤖 = fully scriptable once the token/secret exists.

### A. GitHub (gh)

```bash
# 🔑 one-time: authenticate gh (opens browser / device code)
gh auth login

# 🤖 create the repo and push (run from the project dir)
git init && git add -A && git commit -m "Initial Headache Diary scaffold"
gh repo create headache-diary --private --source=. --remote=origin --push
```

If `gh auth login` can't open a browser, use `gh auth login --with-token < token.txt` (🔑 the PAT is created in the GitHub UI: Settings → Developer settings → Tokens, scopes `repo`, `workflow`).

### B. Vercel

```bash
npm i -g vercel            # or: npx vercel ...

# 🔑 authenticate (browser/email confirmation)
vercel login

# 🤖 link the local dir to a Vercel project (non-interactive)
vercel link --yes

# 🤖 add env vars (repeat per environment; values prompted or piped)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY preview
# (optional, server-only — never NEXT_PUBLIC_)
# vercel env add SUPABASE_SECRET_KEY production

# 🤖 deploy
vercel            # preview deploy
vercel --prod     # production deploy
```

For headless CI, set `VERCEL_TOKEN` (🔑 generated in Vercel dashboard → Settings → Tokens) and pass `--token "$VERCEL_TOKEN"` to every command instead of `vercel login`.

### C. Supabase

```bash
# 🔑 create the project in the Supabase dashboard first (get the project-ref + URL + publishable key)

# 🔑 authenticate the CLI (browser) — OR set SUPABASE_ACCESS_TOKEN for headless
npx supabase login

# 🤖 init local migrations dir (first time only)
npx supabase init

# 🤖 link the repo to the hosted project
npx supabase link --project-ref <your-project-ref>

# place the §5 SQL at supabase/migrations/0001_entries.sql, then:
# 🤖 push the schema + RLS (idempotent — only applies missing migrations)
npx supabase db push

# 🤖 fully non-interactive CI variant:
# SUPABASE_ACCESS_TOKEN=<pat> npx supabase db push --linked
```

Then in the dashboard (🔑 browser): **Auth → URL Configuration** → add Site URL + `${SITE}/auth/confirm` to the allow-list; **Auth → Email Templates → Magic Link** → set the link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.

`.env.local` (🤖 once you have the values):
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
# server-only, optional:
# SUPABASE_SECRET_KEY=sb_secret_xxx
```

**What strictly needs a browser/token:** `gh auth login`, `vercel login` (or `VERCEL_TOKEN`), `supabase login` (or `SUPABASE_ACCESS_TOKEN`), creating the Supabase project, and the two dashboard auth-config edits. Everything else is scriptable.

---

## 9. Consolidated gotchas / pitfalls

**Scaffold / Next 16 / Tailwind v4**
- Tailwind v4: no `tailwind.config.js`, no `content` array. The v3 `@tailwind base/components/utilities` triple does **not** exist — only `@import "tailwindcss";`. `@tailwindcss/postcss` is a separate package and is the #1 setup failure if forgotten.
- `next build` no longer runs ESLint and `next lint` is removed. CI must call `eslint` explicitly or lint errors ship silently.
- Turbopack is default for dev **and** build; drop any `--turbopack` flag from scripts. Opt out with `next dev --webpack`.
- `create-next-app` writes AGENTS.md + CLAUDE.md by default — use `--no-agents-md`.
- Node ≥ 20.9 hard minimum.

**React 19 / R3F**
- Use R3F **v9** (not v8 = React 18; not v10 = alpha). Use ≥ 9.5.0 (we pin 9.6.1) so the bundled reconciler avoids the React 19.1↔19.2 crash.
- The `<Canvas>` **must** be loaded via `next/dynamic({ ssr:false })` — `"use client"` alone is not enough; three.js touches WebGL/window at render.
- `onClick` is unreliable for tap-vs-drag on touch — use the pointerdown/up travel(≤8px)+time(≤300ms) pattern with `setPointerCapture` and `stopPropagation`.
- Classify regions in **local** space, never world. Cap `dpr` at 2; add `AdaptiveDpr` + `PerformanceMonitor`. Set `toneMapped={false}` on emissive markers. Exclude the decorative brain from raycasting (no pointer handlers, `depthWrite=false`).
- `REGION_CENTROIDS` are model-specific — calibrate once or region labels in the doctor report are wrong.
- 3D model licenses: the verified Sketchfab heads are CC-BY, not CC0 — attribute. Decimate the 194k-tri realistic head to ~30–50k before shipping to mobile.

**PWA / Serwist**
- Never use `next-pwa` (unmaintained). `@serwist/next` and `serwist` must be the **same version** (9.5.11).
- SW needs HTTPS; QA offline against a **production** build (`next build && next start`), not dev. Keep `disable:true` in dev to avoid stale-JS ghost bugs.
- `reloadOnOnline:false` so coming back online doesn't blow away an in-progress entry.
- iOS ignores manifest icons for the home screen → ship `apple-touch-icon` (180×180, opaque). iOS has no `beforeinstallprompt` → show a manual "Add to Home Screen" hint (`InstallHint`). Ship a separate 512 `maskable` icon.
- `viewportFit:'cover'` + `black-translucent` draws under the notch → you **must** add `env(safe-area-inset-*)` padding (done in `globals.css`).
- Keep user diary data in IndexedDB, never the SW HTTP cache. Exclude generated `public/sw.js` from tsconfig and gitignore it.

**Supabase / auth / sync**
- Use the new `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, not the anon JWT. Never ship `sb_secret_…` to the browser.
- Next 16: `middleware.ts` → `proxy.ts`, `middleware()` → `proxy()`, Node runtime only. (Next 15: keep `middleware.ts`/`middleware`.)
- Never install `@supabase/auth-helpers-nextjs` (EOL).
- In the proxy: **no code** between `createServerClient(...)` and `getClaims()`, and **return `supabaseResponse` unmodified** — violating either randomly logs users out (the #1 Supabase+Next bug). Use `getClaims()`/`getUser()` for trust decisions, never `getSession()`.
- `cookies()` must be awaited in `server.ts`; keep the `setAll` try/catch (Server Components can't write cookies).
- RLS: `(select auth.uid()) = user_id` (initPlan-cached), plus `to authenticated`. `unique(user_id,date)` → upsert needs `onConflict:'user_id,date'` or you get a 23505.
- IndexedDB can't index booleans → store `_dirty` as 0/1. Generate `id` client-side so local↔remote share the PK (deterministic upsert). `supabase db push` is idempotent.

**Export / i18n / ICHD-3**
- Do **not** use jsPDF/pdf-lib/pdfmake for Devanagari — they don't shape Indic scripts. The browser print route shapes any language natively.
- CSV needs a U+FEFF BOM (Excel) — but JSON must **not** have one. Use `Papa.unparse({quotes:true})` so free-text notes with commas/newlines don't break columns. Delay `revokeObjectURL` ~1.5s (Firefox truncation).
- `window.print()` is client-only; fire it after a paint (`requestAnimationFrame`) once rows are set, and after `document.fonts.ready` if using web fonts. Use `display:table-header-group` (not `position:sticky`) to repeat the table header across pages. Strip the bottom nav in `@media print`. iOS `afterprint` is flaky — keep a visible Back button (hidden in print).
- ICHD-3 engine: indomethacin response (PH crit E, HC crit D) and cervicogenic (crit B clinical/imaging, C4 nerve block) can **never** be auto-MET from diary data → cap at `NEEDS_TEST`. MOH threshold is 15 days for `simple_nonopioid`, else 10. CM (1.3) suppresses CTTH (2.3); CM+MOH are reported together (both codes); NDPH (4.10) takes precedence on daily-from-onset. `PROBABLE` is the precise ICHD 1.5/2.4/3.5 pattern (attack-count shortfall or one missing criterion), not fuzzy uncertainty. The engine reads only structured fields, never the free-text note. Always print the decision-support disclaimer.

---

**Key file paths (all absolute under the project root you scaffold):**
`/headache-diary/next.config.ts`, `/headache-diary/proxy.ts`, `/headache-diary/supabase/migrations/0001_entries.sql`, `/headache-diary/src/app/{layout.tsx,page.tsx,manifest.ts,sw.ts,globals.css}`, `/headache-diary/src/app/report/print/{page.tsx,print.css,layout.tsx}`, `/headache-diary/src/lib/supabase/{client.ts,server.ts,proxy.ts}`, `/headache-diary/src/lib/db/{index.ts,sync.ts}`, `/headache-diary/src/lib/ichd3/{model.ts,engine.ts,aggregate.ts}`, `/headache-diary/src/components/head/{HeadScene.tsx,HeadModel.tsx,regions.ts,heat.ts,Markers.tsx}`.