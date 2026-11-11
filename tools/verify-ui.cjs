const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const root = path.resolve(__dirname, "..");
  const server = http.createServer(async (req, res) => {
    const name = new URL(req.url, "http://localhost").pathname;
    if (!["/", "/index.html", "/app.js", "/styles.css"].includes(name)) {
      res.writeHead(404).end();
      return;
    }
    const file = path.join(root, name === "/" ? "index.html" : name);
    res.setHeader("Content-Type", name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" : "text/html");
    res.end(await fs.readFile(file));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: "block", acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const fixture = {
      settings: { currency: "EUR", monthlyTransfer: "", arrivalDay: "", interestApy: "", lastAutoPostMonth: "", splits: [], theme: { accent: "#45c6a3", header: "#12362f", background: "#10161d", surface: "#17212b" } },
      pots: [{ id: "a", name: "Travel", balance: 500, target: 1000, color: "#b692f6" }, { id: "b", name: "Savings", balance: 200, target: 0, color: "#6aa8ff" }],
      unallocatedBalance: 10,
      transactions: [
        { id: "old", type: "addition", potId: "a", amount: 10, date: "2026-01-01", note: "old" },
        { id: "new", type: "transfer", potId: "b", toPotId: "a", amount: 20, date: "2026-03-01", note: "incoming" },
        { id: "middle", type: "withdrawal", potId: "a", amount: 5, date: "2026-02-01", note: "middle" },
        { id: "other", type: "addition", potId: "b", amount: 1, date: "2026-02-15", note: "other" },
      ],
    };
    await page.addInitScript(data => localStorage.setItem("money-pots-v1", JSON.stringify(data)), fixture);
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem("money-pots-v1")));
    const dates = selector => page.locator(`${selector} .transaction-row span`).allTextContents();
    await page.getByRole("button", { name: "Transactions", exact: true }).click();
    assert.equal(await page.locator("#transactionForm").isVisible(), false);
    assert.deepEqual((await dates("#transactionList")).map(s => s.slice(0, 10)), ["2026-03-01", "2026-02-15", "2026-02-01", "2026-01-01"]);
    assert.deepEqual((await snapshot()).transactions, fixture.transactions, "Sorting must not mutate saved transactions");
    await page.getByRole("button", { name: "New transaction", exact: true }).click();
    assert.equal(await page.locator("#transactionForm").isVisible(), true);
    const checkWidth = async () => {
      const dimensions = await page.evaluate(() => {
        const date = document.querySelector("#txDate").getBoundingClientRect();
        const label = document.querySelector("#txDate").parentElement.getBoundingClientRect();
        return { page: document.documentElement.scrollWidth, viewport: innerWidth, dateRight: date.right, labelRight: label.right };
      });
      assert.ok(dimensions.page <= dimensions.viewport, JSON.stringify(dimensions));
      assert.ok(dimensions.dateRight <= dimensions.labelRight + 1, JSON.stringify(dimensions));
    };
    await checkWidth();
    await page.screenshot({ path: path.join(os.tmpdir(), "money-pots-mobile-form.png"), fullPage: true });
    await page.getByRole("button", { name: "Cancel transaction" }).click();
    assert.equal(await page.locator("#transactionForm").isVisible(), false);
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page.getByRole("button", { name: "Open Travel", exact: true }).click();
    assert.equal(await page.locator("#detailPotName").textContent(), "Travel");
    for (const selector of ["#appHeader", "#accountSummary", "#appNavigation"]) {
      assert.equal(await page.locator(selector).isVisible(), false, `${selector} is hidden in the pot view`);
    }
    assert.equal(await page.locator("#editDetailPot").isVisible(), true);
    const transactionColor = await page.locator("#toggleTransaction").evaluate(el => getComputedStyle(el).backgroundColor);
    assert.equal(transactionColor, "rgb(182, 146, 246)");
    assert.deepEqual((await dates("#detailTransactionList")).map(s => s.slice(0, 10)), ["2026-03-01", "2026-02-01", "2026-01-01"]);
    assert.ok((await page.locator("#detailTransactionList .transaction-row").first().textContent()).includes("+"), "Incoming transfer is positive");
    async function operation(type, amount, date, destination) {
      await page.getByRole("button", { name: "New transaction", exact: true }).click();
      assert.equal(await page.locator("#txPot").inputValue(), "a");
      assert.equal(await page.locator("#txPot").isDisabled(), true);
      await page.locator("#txType").selectOption(type);
      if (destination) await page.locator("#txToPot").selectOption(destination);
      await page.locator("#txAmount").fill(amount);
      await page.locator("#txDate").fill(date);
      await checkWidth();
      await page.getByRole("button", { name: "Save transaction", exact: true }).click();
      assert.equal(await page.locator("#transactionForm").isVisible(), false);
      assert.equal(await page.locator("#detailPotName").textContent(), "Travel");
    }
    await operation("addition", "50", "2026-04-01");
    await operation("withdrawal", "25", "2026-02-10");
    await operation("transfer", "100", "2026-05-01", "b");
    await operation("set", "600", "2026-06-01");
    const saved = await snapshot();
    assert.equal(saved.pots[0].balance, 600);
    assert.equal(saved.pots[1].balance, 300);
    assert.deepEqual(Object.keys(saved).sort(), Object.keys(fixture).sort(), "No new state fields");
    assert.deepEqual(Object.keys(saved.settings).sort(), Object.keys(fixture.settings).sort(), "No new settings fields");
    assert.deepEqual(saved.pots.map(p => Object.keys(p).sort()), fixture.pots.map(p => Object.keys(p).sort()), "Pot schema unchanged");
    assert.deepEqual((await dates("#detailTransactionList")).map(s => s.slice(0, 10)), ["2026-06-01", "2026-05-01", "2026-04-01", "2026-03-01", "2026-02-10", "2026-02-01", "2026-01-01"]);
    await page.screenshot({ path: path.join(os.tmpdir(), "money-pots-mobile-detail.png"), fullPage: true });
    await page.getByRole("button", { name: "Back to pots" }).click();
    await page.getByRole("button", { name: "Open Unallocated", exact: true }).click();
    assert.equal(await page.locator("#editDetailPot").isVisible(), false);
    await page.getByRole("button", { name: "Back to pots" }).click();
    await page.getByRole("button", { name: "Transactions", exact: true }).click();
    await page.getByRole("button", { name: "New transaction", exact: true }).click();
    assert.equal(await page.locator("#txPot").isEnabled(), true);
    await page.setViewportSize({ width: 1280, height: 800 });
    await checkWidth();
    await page.screenshot({ path: path.join(os.tmpdir(), "money-pots-desktop-transactions.png"), fullPage: true });
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export backup", exact: true }).click();
    const download = await downloaded;
    const backup = JSON.parse(await fs.readFile(await download.path(), "utf8"));
    assert.equal(backup.backupVersion, 2);
    assert.deepEqual(backup.transactions, saved.transactions);
    assert.deepEqual(Object.keys(backup).sort(), [...Object.keys(saved), "backupVersion", "backupExportedAt"].sort());
    await page.locator("#importData").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("money-pots-v1")).pots[0].balance === 600);
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page.getByRole("button", { name: "Open Travel", exact: true }).click();
    assert.equal(await page.locator("#detailTransactionList .transaction-row").count(), 7);
    await page.locator("#editDetailPot").click();
    assert.equal(await page.locator("#potForm").isVisible(), true);
    assert.equal(await page.locator("#potName").inputValue(), "Travel");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await page.locator("#potForm").isVisible(), false);
    await page.getByRole("button", { name: "New pot", exact: true }).click();
    assert.equal(await page.locator("#potName").inputValue(), "");
    await page.locator("#potName").fill("Bike");
    await page.locator("#potBalance").fill("50");
    await page.getByRole("button", { name: "Save pot", exact: true }).click();
    assert.equal(await page.locator("#potForm").isVisible(), false);
    assert.ok((await page.locator("#editorList").textContent()).includes("Bike"));
    await page.setViewportSize({ width: 393, height: 852 });
    for (const [name, selector] of [["Schedule", "#scheduleSettings"], ["Appearance", "#appearanceSettings"], ["Data", "#dataSettings"], ["Pots", "#potSettings"]]) {
      await page.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name, exact: true }).click();
      assert.equal(await page.locator(selector).isVisible(), true);
      assert.equal(await page.locator("[data-settings-panel]:visible").count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(os.tmpdir(), `money-pots-mobile-settings-${name.toLowerCase()}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log("PASS: focused pot view, accent action, pot editor, settings navigation, date order, all balance operations, mobile/desktop sizing, and unchanged backup schema.");
    console.log(`Screenshots: ${os.tmpdir()}`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
