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
