import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  classify,
  progressiveInsight,
  toAggregate,
  type DxResult,
} from "../src/lib/ichd3";
import { runCauseFinder } from "../src/lib/cause-finder";
import { buildReportRows, summarize } from "../src/lib/report/build";
import { entriesToDiaryEntries } from "../src/lib/report/entry-adapter";
import {
  CASE_ANCHOR_END,
  CASE_ANCHOR_START,
  publicCaseFixtures,
  type PublicCaseFixture,
} from "../validation/public-case-fixtures";

type CaseStatus = "similar" | "honest-limited" | "fake-or-mismatch";

interface CaseValidation {
  id: string;
  source: PublicCaseFixture["source"];
  status: CaseStatus;
  expectedDx: string[];
  observationLimitedDx: string[];
  positiveDx: Array<Pick<DxResult, "code" | "name" | "verdict" | "missing">>;
  causeIds: string[];
  reportRows: number;
  headacheDays: number;
  insightStage: string;
  mohAtRisk: boolean;
  issues: string[];
}

interface IterationFingerprint {
  cases: Array<{
    id: string;
    rows: number;
    summary: ReturnType<typeof summarize>;
    dx: Array<Pick<DxResult, "code" | "name" | "verdict" | "missing">>;
    causeIds: string[];
    insightStage: string;
    mohAtRisk: boolean;
  }>;
}

const range = {
  kind: "custom" as const,
  from: CASE_ANCHOR_START,
  to: CASE_ANCHOR_END,
};

function argInt(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (!found) return fallback;
  const parsed = Number(found.slice(prefix.length));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function dxMatches(dx: DxResult, prefix: string): boolean {
  return dx.code === prefix || dx.code.startsWith(`${prefix}.`) || dx.code.startsWith(prefix);
}

function positive(dx: DxResult): boolean {
  return dx.verdict !== "NOT_MET";
}

function hasObservationLimit(dx: DxResult): boolean {
  return dx.criteria.some(
    (criterion) =>
      !criterion.passed &&
      (criterion.text.includes(">3 months") ||
        criterion.text.includes(">3mo") ||
        criterion.reason?.includes("mo")),
  );
}

function visibleDx(dx: DxResult[]) {
  return dx
    .filter(positive)
    .map(({ code, name, verdict, missing }) => ({ code, name, verdict, missing }));
}

function allDxResults(caseFixture: PublicCaseFixture): DxResult[] {
  const aggregateResult = toAggregate(caseFixture.entries);
  if (Array.isArray(aggregateResult)) return aggregateResult;
  if (aggregateResult) return classify(aggregateResult);
  return [];
}

function validateCase(caseFixture: PublicCaseFixture): CaseValidation {
  const rows = buildReportRows(entriesToDiaryEntries(caseFixture.entries), range);
  const dx = allDxResults(caseFixture);
  const positiveDx = visibleDx(dx);
  const causeReport = runCauseFinder(caseFixture.entries, caseFixture.profile);
  const causeIds = causeReport.candidates.map((candidate) => candidate.id);
  const insight = progressiveInsight(caseFixture.entries);
  const issues: string[] = [];

  if (caseFixture.entries.length !== 30) {
    issues.push(`fixture has ${caseFixture.entries.length} entries, expected 30`);
  }
  if (rows.length !== 30) {
    issues.push(`report produced ${rows.length} rows, expected 30`);
  }
  if (insight.stage !== "strong") {
    issues.push(`30-day diary insight stage is ${insight.stage}, expected strong`);
  }

  for (const expected of caseFixture.expectedDx) {
    if (!dx.some((result) => dxMatches(result, expected) && positive(result))) {
      issues.push(`missing expected positive ICHD signal ${expected}`);
    }
  }

  const observationLimitedDx = caseFixture.observationLimitedDx ?? [];
  for (const expected of observationLimitedDx) {
    if (!dx.some((result) => dxMatches(result, expected) && hasObservationLimit(result))) {
      issues.push(`missing honest observation-limit signal for ${expected}`);
    }
  }

  for (const expected of caseFixture.expectedCauseIds ?? []) {
    if (!causeIds.includes(expected)) {
      issues.push(`missing expected cause-finder candidate ${expected}`);
    }
  }

  if (
    typeof caseFixture.expectedMohAtRisk === "boolean" &&
    causeReport.moh.atRisk !== caseFixture.expectedMohAtRisk
  ) {
    issues.push(
      `MOH risk mismatch: got ${causeReport.moh.atRisk}, expected ${caseFixture.expectedMohAtRisk}`,
    );
  }

  if (
    !caseFixture.expectedDx.some((expected) => expected.startsWith("11.2.1")) &&
    !(caseFixture.expectedCauseIds ?? []).includes("cervicogenic") &&
    dx.some((result) => result.code === "11.2.1" && positive(result))
  ) {
    issues.push("unexpected cervicogenic positive/needs-test signal");
  }

  const hasPositiveExpectation =
    caseFixture.expectedDx.length > 0 ||
    (caseFixture.expectedCauseIds?.length ?? 0) > 0 ||
    caseFixture.expectedMohAtRisk === true;
  const hasLimitedExpectation = observationLimitedDx.length > 0;
  const status: CaseStatus =
    issues.length > 0
      ? "fake-or-mismatch"
      : hasPositiveExpectation
        ? "similar"
        : hasLimitedExpectation
          ? "honest-limited"
          : "similar";

  return {
    id: caseFixture.id,
    source: caseFixture.source,
    status,
    expectedDx: caseFixture.expectedDx,
    observationLimitedDx,
    positiveDx,
    causeIds,
    reportRows: rows.length,
    headacheDays: rows.filter((row) => row.worst > 0).length,
    insightStage: insight.stage,
    mohAtRisk: causeReport.moh.atRisk,
    issues,
  };
}

function fingerprint(): IterationFingerprint {
  return {
    cases: publicCaseFixtures.map((caseFixture) => {
      const rows = buildReportRows(entriesToDiaryEntries(caseFixture.entries), range);
      const dx = allDxResults(caseFixture);
      const causeReport = runCauseFinder(caseFixture.entries, caseFixture.profile);
      return {
        id: caseFixture.id,
        rows: rows.length,
        summary: summarize(rows),
        dx: dx.map(({ code, name, verdict, missing }) => ({
          code,
          name,
          verdict,
          missing,
        })),
        causeIds: causeReport.candidates.map((candidate) => candidate.id),
        insightStage: progressiveInsight(caseFixture.entries).stage,
        mohAtRisk: causeReport.moh.atRisk,
      };
    }),
  };
}

function markdownReport(input: {
  iterations: number;
  deterministic: boolean;
  cases: CaseValidation[];
}): string {
  const byStatus = input.cases.reduce<Record<CaseStatus, number>>(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { similar: 0, "honest-limited": 0, "fake-or-mismatch": 0 },
  );

  const lines = [
    "# Public Case Validation Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Date window: ${CASE_ANCHOR_START} to ${CASE_ANCHOR_END}`,
    `Fixtures: ${input.cases.length}`,
    `Iterations: ${input.iterations}`,
    `Deterministic across iterations: ${input.deterministic ? "yes" : "no"}`,
    "",
    "## Summary",
    "",
    `- Similar report signals: ${byStatus.similar}`,
    `- Honest 30-day observation limits: ${byStatus["honest-limited"]}`,
    `- Fake or mismatched signals: ${byStatus["fake-or-mismatch"]}`,
    "",
    "## Cases",
    "",
  ];

  for (const item of input.cases) {
    const dx = item.positiveDx.length
      ? item.positiveDx.map((d) => `${d.code} ${d.verdict}`).join(", ")
      : "none";
    const causes = item.causeIds.length ? item.causeIds.join(", ") : "none";
    lines.push(
      `### ${item.id}`,
      "",
      `- Status: ${item.status}`,
      `- Source: ${item.source.sourceDiagnosis}; ${item.source.url}`,
      `- Rows/headache days: ${item.reportRows}/${item.headacheDays}`,
      `- Positive ICHD signals: ${dx}`,
      `- Observation-limited checks: ${item.observationLimitedDx.join(", ") || "none"}`,
      `- Cause candidates: ${causes}`,
      `- MOH at risk: ${item.mohAtRisk}`,
      `- Issues: ${item.issues.join("; ") || "none"}`,
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}

const iterations = argInt("iterations", 50);

if (publicCaseFixtures.length !== 30) {
  throw new Error(`Expected exactly 30 public case fixtures, got ${publicCaseFixtures.length}`);
}

const first = fingerprint();
let deterministic = true;
for (let i = 1; i < iterations; i += 1) {
  const next = fingerprint();
  if (JSON.stringify(next) !== JSON.stringify(first)) {
    deterministic = false;
    break;
  }
}

const cases = publicCaseFixtures.map(validateCase);
const failures = cases.filter((item) => item.issues.length > 0);

const reportDir = join(process.cwd(), "validation", "reports");
mkdirSync(reportDir, { recursive: true });
writeFileSync(
  join(reportDir, "public-case-validation.json"),
  `${JSON.stringify({ iterations, deterministic, cases }, null, 2)}\n`,
);
writeFileSync(
  join(reportDir, "public-case-validation.md"),
  markdownReport({ iterations, deterministic, cases }),
);

if (!deterministic) {
  throw new Error(`Validation output changed across ${iterations} iterations`);
}

if (failures.length > 0) {
  const details = failures
    .map((item) => `${item.id}: ${item.issues.join("; ")}`)
    .join("\n");
  throw new Error(`Public case validation failed:\n${details}`);
}

console.log(
  `Validated ${publicCaseFixtures.length} public cases across ${iterations} deterministic iterations.`,
);
