import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { chromium, type Page } from "playwright";

import {
  CASE_ANCHOR_END,
  CASE_ANCHOR_START,
  publicCaseFixtures,
  type PublicCaseFixture,
} from "../validation/public-case-fixtures";

interface PdfValidationResult {
  caseId: string;
  sourceUrl: string;
  entriesWritten: number;
  pdfPath: string;
  textPath: string;
  expectedPhrases: string[];
  missingPhrases: string[];
  reportRowsInDom: number;
}

function arg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function slug(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function writeDiaryEntries(page: Page, entries: unknown[]) {
  return page.evaluate(
    ({ entriesToWrite, rangeStart, rangeEnd }) =>
      new Promise<number>((resolve, reject) => {
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
          let written = 0;
          const tx = db.transaction("entries", "readwrite");
          const store = tx.objectStore("entries");
          for (const entry of entriesToWrite) {
            const put = store.put(entry);
            put.onsuccess = () => {
              written += 1;
            };
          }
          tx.oncomplete = () => {
            localStorage.setItem(
              "hd.report.range",
              JSON.stringify({ kind: "custom", from: rangeStart, to: rangeEnd }),
            );
            db.close();
            resolve(written);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    {
      entriesToWrite: entries,
      rangeStart: CASE_ANCHOR_START,
      rangeEnd: CASE_ANCHOR_END,
    },
  );
}

function extractPdfText(pdfPath: string): string {
  return execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

function expectedPhrases(caseFixture: PublicCaseFixture): string[] {
  const phrases = [
    "Headache Diary",
    "Doctor Report",
    "ICHD-3 Classification Analysis",
    "Decision support, not a diagnosis",
  ];

  const diagnosisText: Record<string, string> = {
    "1.1": "Migraine without aura",
    "1.2": "Migraine with aura",
    "3.1": "Cluster headache",
    "3.2": "Paroxysmal hemicrania",
    "11.2.1": "Cervicogenic headache",
  };

  for (const code of caseFixture.expectedDx) {
    const text = diagnosisText[code];
    if (text) phrases.push(text);
    phrases.push(`ICHD-3 ${code}`);
  }

  return [...new Set(phrases)];
}

async function validateCasePdf(
  baseUrl: string,
  caseFixture: PublicCaseFixture,
): Promise<PdfValidationResult> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) console.log(`[pdf:validate] navigated ${frame.url()}`);
  });

  // Use a same-origin non-app document for IndexedDB writes so app effects,
  // hot reload, or background sync cannot navigate while the 30 writes run.
  await page.route("**/__diary-writer.html", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><title>Diary writer</title><main>Diary writer</main>",
    });
  });
  await page.goto(`${baseUrl}/__diary-writer.html`, { waitUntil: "load" });
  console.log(`[pdf:validate] writing ${caseFixture.entries.length} diary entries`);
  const entriesWritten = await writeDiaryEntries(page, caseFixture.entries);
  console.log(`[pdf:validate] wrote ${entriesWritten} diary entries`);
  if (entriesWritten !== 30) {
    throw new Error(`Expected 30 diary writes, wrote ${entriesWritten}`);
  }

  await page.goto(`${baseUrl}/report/print`, { waitUntil: "networkidle" });
  await page.getByText("Headache Diary").waitFor({ state: "visible", timeout: 10_000 });
  await page
    .getByText("ICHD-3 Classification Analysis")
    .waitFor({ state: "visible", timeout: 10_000 });

  const reportRowsInDom = await page.locator("table.grid tbody tr").count();
  if (reportRowsInDom !== 30) {
    throw new Error(`Expected 30 report rows in print DOM, got ${reportRowsInDom}`);
  }
  if (consoleErrors.length > 0) {
    throw new Error(`Browser console errors while printing PDF: ${consoleErrors.join(" | ")}`);
  }

  const reportDir = join(process.cwd(), "validation", "reports", "pdf");
  mkdirSync(reportDir, { recursive: true });
  const caseSlug = slug(caseFixture.id);
  const pdfPath = join(reportDir, `${caseSlug}.pdf`);
  const textPath = join(reportDir, `${caseSlug}.txt`);

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });

  await browser.close();

  const text = extractPdfText(pdfPath);
  writeFileSync(textPath, text);

  const phrases = expectedPhrases(caseFixture);
  const missingPhrases = phrases.filter((phrase) => !text.includes(phrase));
  return {
    caseId: caseFixture.id,
    sourceUrl: caseFixture.source.url,
    entriesWritten,
    pdfPath: relative(process.cwd(), pdfPath),
    textPath: relative(process.cwd(), textPath),
    expectedPhrases: phrases,
    missingPhrases,
    reportRowsInDom,
  };
}

const baseUrl = arg("url", "http://localhost:3000").replace(/\/$/, "");
const caseId = arg("case", "mwa-myoclonus-pmc11464945");
const caseFixture = publicCaseFixtures.find((fixture) => fixture.id === caseId);

if (!caseFixture) {
  throw new Error(`Unknown case id: ${caseId}`);
}

const result = await validateCasePdf(baseUrl, caseFixture);
const reportDir = join(process.cwd(), "validation", "reports", "pdf");
mkdirSync(reportDir, { recursive: true });
writeFileSync(
  join(reportDir, `${slug(caseFixture.id)}-validation.json`),
  `${JSON.stringify({ baseUrl, result }, null, 2)}\n`,
);

if (result.missingPhrases.length > 0) {
  throw new Error(
    `PDF validation failed for ${result.caseId}; missing: ${result.missingPhrases.join(", ")}`,
  );
}

console.log(
  `Wrote ${result.entriesWritten} diary entries, printed PDF, and validated ${result.caseId}.`,
);
