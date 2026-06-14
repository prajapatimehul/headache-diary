import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Page } from "playwright";

import {
  CASE_ANCHOR_END,
  CASE_ANCHOR_START,
  publicCaseFixtures,
} from "../validation/public-case-fixtures";

interface SmokeResult {
  viewport: string;
  reportRows: number;
  hasMigraineWithAura: boolean;
  hasUnexpectedCervicogenicDx: boolean;
  consoleErrors: string[];
}

function arg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

async function resetDiary(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase("headache-diary");
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();
      }),
  );
}

async function seedDiary(page: Page, entries: unknown[]) {
  await page.evaluate(
    ({ entriesToSeed, rangeStart, rangeEnd }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("headache-diary");
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("entries")) {
            db.createObjectStore("entries", { keyPath: "id" });
          }
        };
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("entries", "readwrite");
          const store = tx.objectStore("entries");
          store.clear();
          for (const entry of entriesToSeed) store.put(entry);
          tx.oncomplete = () => {
            localStorage.setItem(
              "hd.report.range",
              JSON.stringify({ kind: "custom", from: rangeStart, to: rangeEnd }),
            );
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    {
      entriesToSeed: entries,
      rangeStart: CASE_ANCHOR_START,
      rangeEnd: CASE_ANCHOR_END,
    },
  );
}

async function assertVisible(page: Page, text: string | RegExp) {
  const locator = page.getByText(text);
  await locator.first().waitFor({ state: "visible", timeout: 10_000 });
}

async function runViewport(
  baseUrl: string,
  viewport: { width: number; height: number; name: string },
): Promise<SmokeResult> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await assertVisible(page, "Today");
  await assertVisible(page, "Save today's entry");

  await resetDiary(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("switch", { name: /No headache today/i }).click();
  await page.getByRole("button", { name: /Save today's entry/i }).click();
  await assertVisible(page, "Saved");

  await resetDiary(page);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await seedDiary(page, publicCaseFixtures[0].entries);

  await page.goto(`${baseUrl}/report`, { waitUntil: "networkidle" });
  await assertVisible(page, "Export your diary");
  await assertVisible(page, "PDF / Print");

  await page.goto(`${baseUrl}/report/print`, { waitUntil: "networkidle" });
  await assertVisible(page, "Headache Diary");
  await assertVisible(page, "ICHD-3 Classification Analysis");
  await assertVisible(page, "Migraine with aura");

  const reportRows = await page.locator("table.grid tbody tr").count();
  const hasUnexpectedCervicogenicDx =
    (await page.locator("#ichd3-analysis .dx-title", { hasText: "Cervicogenic headache" }).count()) > 0;
  const hasMigraineWithAura =
    (await page.locator("#ichd3-analysis .dx-title", { hasText: "Migraine with aura" }).count()) > 0;

  const reportDir = join(process.cwd(), "validation", "reports");
  mkdirSync(reportDir, { recursive: true });
  await page.screenshot({
    path: join(reportDir, `browser-smoke-${viewport.name}.png`),
    fullPage: true,
  });

  await browser.close();

  return {
    viewport: viewport.name,
    reportRows,
    hasMigraineWithAura,
    hasUnexpectedCervicogenicDx,
    consoleErrors,
  };
}

const baseUrl = arg("url", "http://localhost:3000").replace(/\/$/, "");
const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
];

const results: SmokeResult[] = [];
for (const viewport of viewports) {
  results.push(await runViewport(baseUrl, viewport));
}

const reportDir = join(process.cwd(), "validation", "reports");
mkdirSync(reportDir, { recursive: true });
writeFileSync(
  join(reportDir, "browser-smoke.json"),
  `${JSON.stringify({ baseUrl, results }, null, 2)}\n`,
);

const failures = results.flatMap((result) => {
  const issues: string[] = [];
  if (result.reportRows !== 30) issues.push(`${result.viewport}: expected 30 report rows`);
  if (!result.hasMigraineWithAura) issues.push(`${result.viewport}: missing migraine-with-aura dx`);
  if (result.hasUnexpectedCervicogenicDx) {
    issues.push(`${result.viewport}: unexpected cervicogenic dx in migraine report`);
  }
  if (result.consoleErrors.length) {
    issues.push(`${result.viewport}: console errors: ${result.consoleErrors.join(" | ")}`);
  }
  return issues;
});

if (failures.length > 0) {
  throw new Error(`Browser smoke failed:\n${failures.join("\n")}`);
}

console.log(`Browser smoke passed for ${results.map((r) => r.viewport).join(", ")}.`);
