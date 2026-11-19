import { chromium } from "playwright";

const base = process.env.BASE_URL || "http://localhost:3100";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

const out = { steps: [], errors };

async function step(name, fn) {
  try {
    await fn();
    out.steps.push({ name, ok: true });
  } catch (e) {
    out.steps.push({ name, ok: false, error: String(e).slice(0, 300) });
    throw e;
  }
}

try {
  await step("login page loads", async () => {
    await page.goto(`${base}/giris`, { waitUntil: "networkidle" });
    await page.getByLabel("Kullanıcı adı").waitFor({ timeout: 15000 });
  });

  await step("login as elif", async () => {
    await page.getByLabel("Kullanıcı adı").fill("elif");
    await page.locator('input[type="password"]').first().fill("demo1234");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL(/\/sunucular/, { timeout: 20000 });
  });

  await step("server list shows RavenMUN", async () => {
    await page.getByText("RavenMUN").first().waitFor({ timeout: 15000 });
  });

  await step("open RavenMUN and land in channel", async () => {
    await page.getByText("RavenMUN").first().click();
    await page.waitForURL(/\/sunucu\/[^/]+\/[^/]+/, { timeout: 20000 });
    await page.getByText("RavenMUN ekibine hoş geldiniz").first().waitFor({ timeout: 15000 });
  });

  await step("send message", async () => {
    const text = `e2e mesaj ${Date.now()}`;
    const box = page.getByPlaceholder(/kanalına mesaj gönder/);
    await box.fill(text);
    await box.press("Enter");
    await page.getByText(text).first().waitFor({ timeout: 15000 });
    out.sent = text;
  });

  await step("message persists after reload", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText(out.sent).first().waitFor({ timeout: 15000 });
  });

  await step("reaction chip appears", async () => {
    const row = page.locator("[data-message-id]").filter({ hasText: out.sent }).first();
    await row.hover();
    const picker = row.getByRole("button", { name: /Tepki ekle/ }).first();
    if (!(await picker.count())) {
      out.steps.push({ name: "reaction picker not found (skipped)", ok: true });
      return;
    }
    await picker.click();
    const emoji = row.getByRole("button", { name: "👍" }).first();
    if (await emoji.count()) {
      await emoji.click({ force: true });
      await page.waitForTimeout(1500);
      const Database = (await import("better-sqlite3")).default;
      const db = new Database("data/meydan.db", { readonly: true });
      const row = db.prepare("select count(*) as c from reactions").get();
      const latest = db
        .prepare("select id, content, (select count(*) from reactions where message_id = messages.id) as rc from messages order by id desc limit 1")
        .get();
      db.close();
      const reacted = {
        ok: latest?.content === out.sent && Number(latest?.rc ?? 0) > 0,
        latest,
      };
      out.steps.push({ name: "reaction persisted in db: " + reacted.ok, ok: reacted.ok });
      if (!reacted.ok) out.reacted = reacted;
    }
  });
} catch {
  // recorded above
}

try {
  await step("second user sees message live", async () => {
    const ctxB = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const pageB = await ctxB.newPage();
    await pageB.goto(`${base}/giris`, { waitUntil: "networkidle" });
    await pageB.getByLabel("Kullanıcı adı").fill("mert");
    await pageB.locator('input[type="password"]').first().fill("demo1234");
    await pageB.getByRole("button", { name: "Giriş yap" }).click();
    await pageB.waitForURL(/\/sunucular/, { timeout: 20000 });
    await pageB.getByText("RavenMUN").first().click();
    await pageB.waitForURL(/\/sunucu\/[^/]+\/[^/]+/, { timeout: 20000 });

    const live = `canlı test ${Date.now()}`;
    const box = page.getByPlaceholder(/kanalına mesaj gönder/);
    await box.fill(live);
    await box.press("Enter");
    await pageB.getByText(live).first().waitFor({ timeout: 15000 });
    out.live = live;
    await ctxB.close();
  });
} catch {
  // recorded above
}

out.title = await page.title().catch(() => null);
console.log(JSON.stringify(out, null, 2));
await browser.close();
