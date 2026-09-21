import { chromium } from "playwright";

const BASE_URL = "http://localhost:3008";
const EMAIL = "zeyad.ragab+step16test@thegdevelopments.com";
const PASSWORD = "TestPass1234";

const JD = `
Senior React Developer - Cairo, Egypt

We are looking for a Senior React Developer to join our growing engineering
team in Cairo. You will be responsible for building and maintaining
customer-facing web applications used by thousands of users daily.

Responsibilities:
- Build responsive, accessible UIs using React and TypeScript
- Collaborate with backend engineers on API design
- Mentor junior developers and review pull requests
- Improve performance and test coverage of existing features

Requirements:
- 5+ years of professional experience with React
- Strong TypeScript and JavaScript fundamentals
- Experience with Next.js and modern build tooling
- Familiarity with PostgreSQL or similar relational databases
- Bachelor's degree in Computer Science or equivalent experience

Nice to have:
- Experience with Node.js backend development
- Experience with automated testing (Vitest, Playwright)

This is a full-time, hybrid role based in Cairo, Egypt.
`.trim();

function log(section) {
  console.log(`\n=== ${section} ===`);
}

const browser = await chromium.launch();
const page = await browser.newPage();

log("Login");
await page.goto(`${BASE_URL}/login`);
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(BASE_URL + "/dashboard", { timeout: 10000 });
console.log("Logged in, landed on dashboard.");

log("New Job: paste JD + Analyze (real Gemini call)");
await page.goto(`${BASE_URL}/jobs/new`);
await page.fill('[data-testid="jd-textarea"]', JD);
await page.click('button:has-text("Analyze Job")');

async function pollForOutcome(successText, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hasSuccess = (await page.locator(`text=${successText}`).count()) > 0;
    if (hasSuccess) return "ok";

    const alerts = await page.locator('[role="alert"]').allInnerTexts();
    const nonEmptyAlert = alerts.find((t) => t.trim().length > 0);
    if (nonEmptyAlert) return "error: " + nonEmptyAlert;

    await page.waitForTimeout(500);
  }
  return "error: timed out waiting for a result";
}

const analyzeResult = await pollForOutcome("Extracted Requirements", 60000);
console.log("Analyze result:", analyzeResult);
if (analyzeResult !== "ok") {
  console.log("ANALYZE FAILED - aborting rest of e2e run.");
  await browser.close();
  process.exit(1);
}

log("Generate Search Queries (real Gemini call)");
await page.click('button:has-text("Generate Search Queries")');
await page.waitForSelector('button:has-text("Find Candidates")', { timeout: 60000 });
console.log("Queries section loaded.");

log("Find Candidates (real SerpApi provider, async job)");
await page.click('button:has-text("Find Candidates")');
await page.waitForSelector('[data-testid="search-run-result"]', { timeout: 15000 });

let finalStatus = null;
for (let i = 0; i < 30; i++) {
  const statusText = await page.locator('[data-testid="search-run-status"]').innerText();
  console.log(`  poll ${i + 1}: ${statusText}`);
  if (statusText.includes("complete") || statusText.includes("error")) {
    finalStatus = statusText;
    break;
  }
  await page.waitForTimeout(1500);
}
console.log("Final search status:", finalStatus);
const resultText = await page.locator('[data-testid="search-run-result"]').innerText();
console.log("Search run result box:\n" + resultText);

// Extract job id from URL used by ExportButton isn't visible yet; get it via API.
const jobId = await page.evaluate(async () => {
  const res = await fetch("/api/jobs?limit=1");
  const data = await res.json();
  return data.jobs[0].id;
});
console.log("JOB_ID=" + jobId);

log("Jobs list page shows the new job");
await page.goto(`${BASE_URL}/jobs`);
await page.waitForFunction(
  () => !document.querySelector("main")?.innerText.includes("Loading jobs"),
  { timeout: 5000 },
);
console.log(await page.locator("main").innerText());

log("Candidates page: filters, sort, pagination, Score Candidates");
await page.goto(`${BASE_URL}/candidates?jobId=${jobId}`);
await page.waitForFunction(
  () => !document.querySelector("main")?.innerText.includes("Loading candidates"),
  { timeout: 10000 },
);
console.log("Candidates loaded:\n" + (await page.locator("main").innerText()));

const scoreButton = page.locator('[data-testid="score-candidates-button"]');
const hasScoreButton = await scoreButton.count();
console.log("Score Candidates button present:", hasScoreButton > 0);

if (hasScoreButton > 0) {
  await scoreButton.click();
  let scoreResult = "error: timed out waiting for a result";
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const summaryCount = await page.locator('[data-testid="score-summary"]').count();
    if (summaryCount > 0) {
      scoreResult = "ok: " + (await page.locator('[data-testid="score-summary"]').innerText());
      break;
    }
    const alerts = await page.locator('[role="alert"]').allInnerTexts();
    const nonEmptyAlert = alerts.find((t) => t.trim().length > 0);
    if (nonEmptyAlert) {
      scoreResult = "error: " + nonEmptyAlert;
      break;
    }
    await page.waitForTimeout(1000);
  }
  console.log("Score Candidates result:", scoreResult);
}

log("Candidates table after scoring (should now show match scores)");
console.log(await page.locator('[data-testid="candidates-table"]').innerText());

log("Open first candidate profile");
const firstCandidateLink = page.locator('[data-testid="candidate-row"] a').first();
await firstCandidateLink.click();
await page.waitForSelector('[data-testid="match-breakdown"]', { timeout: 10000 });
console.log(await page.locator("main").innerText());

log("Change status + add note on candidate profile");
await page.locator('[data-testid="status-select"]').click();
await page.locator('[role="option"]', { hasText: "Shortlisted" }).click();
await page.waitForTimeout(500);
await page.fill('[data-testid="note-input"]', "E2E verification note");
await page.click('[data-testid="note-add-button"]');
await page.waitForSelector('[data-testid="note-item"]', { timeout: 5000 });
console.log("Status + note applied. Reloading to confirm persistence...");
await page.reload();
await page.waitForSelector('[data-testid="notes-list"]', { timeout: 10000 });
console.log("After reload:\n" + (await page.locator("main").innerText()));

log("Dashboard reflects everything");
await page.goto(`${BASE_URL}/dashboard`);
await page.waitForFunction(
  () => !!document.querySelector("main")?.innerText.includes("Total Jobs"),
  { timeout: 10000 },
);
console.log(await page.locator("main").innerText());

console.log("\nJOB_ID=" + jobId);
await browser.close();
