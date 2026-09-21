import { chromium } from "playwright";

const BASE_URL = "http://localhost:3008";
const EMAIL = "zeyad.ragab+step16test@thegdevelopments.com";
const PASSWORD = "TestPass1234";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE_URL}/login`);
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(BASE_URL + "/dashboard", { timeout: 10000 });

for (let i = 0; i < 3; i++) {
  const result = await page.evaluate(async () => {
    const res = await fetch("/api/jobs/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobDescriptionText:
          "Senior React Developer. 5+ years React and TypeScript experience required. Cairo, Egypt. Full-time hybrid role building customer facing web apps.",
      }),
    });
    return { status: res.status, body: await res.json() };
  });
  console.log(`Attempt ${i + 1}:`, JSON.stringify(result));
  await new Promise((r) => setTimeout(r, 1000));
}

await browser.close();
