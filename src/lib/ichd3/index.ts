// Public barrel for the ICHD-3 classification engine.
//
// Lets consumers `import { classify, toAggregate, progressiveInsight } from "@/lib/ichd3"`
// (the report agent does exactly this) while the CONTRACT's authoritative type
// locations still hold: types originate in model.ts and are re-exported here and
// from engine.ts. Import-site choice (barrel vs. deep path) is free.

export type {
  Verdict,
  CriterionResult,
  DxResult,
  DiaryAggregate,
  AttackProfile,
} from "./model";

export {
  // schemas / parsers
  AttackProfile as AttackProfileSchema,
  DiaryAggregate as DiaryAggregateSchema,
  // enums
  Laterality,
  Quality,
  Nausea,
  PainRegion,
  AuraType,
  BoutPattern,
  OnsetPattern,
  MedClass,
  IndoResponse,
  TriState,
} from "./model";

export {
  // top-level
  classify,
  progressiveInsight,
  // individual dx functions
  migraineWithoutAura,
  migraineWithAura,
  chronicMigraine,
  tensionType,
  clusterHeadache,
  paroxysmalHemicrania,
  hemicraniaContinua,
  medicationOveruse,
  ndph,
  cervicogenic,
} from "./engine";

export type { InsightStage, ProgressiveInsight } from "./engine";

export { toAggregate } from "./aggregate";
