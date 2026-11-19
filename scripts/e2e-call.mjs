import { chromium } from "playwright";

const base = (process.env.BASE_URL || "http://localhost:3100").replace(/\/+$/u, "");
const DEMO_PASSWORD = "demo1234";
const JOIN_LABEL = "Sesli sohbete katıl";

const report = {
  base,
  steps: [],
  pageErrors: [],
  result: null,
};

function record(name, detail = undefined) {
  report.steps.push({ name, ok: true, ...(detail ? { detail } : {}) });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function step(name, run) {
  try {
    await run();
    record(name);
  } catch (error) {
    report.steps.push({ name, ok: false, error: String(error).slice(0, 500) });
    throw error;
  }
}

async function login(page, username) {
  await page.goto(`${base}/giris`, { waitUntil: "networkidle" });
  await page.getByLabel("Kullanıcı adı").fill(username);
  await page.locator('input[type="password"]').first().fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/sunucular/u, { timeout: 20_000 });
}

function trackPageErrors(page, label) {
  page.on("pageerror", (error) => {
    report.pageErrors.push(`${label}: ${String(error)}`);
  });
}

async function waitForConnectedPeer(page, label) {
  await page.waitForFunction(
    () => {
      const state = window.__meydanCallState;
      return Boolean(
        state &&
          state.joined &&
          state.participantCount === 2 &&
          state.peers.some((peer) => peer.connectionState === "connected"),
      );
    },
    null,
    { timeout: 30_000 },
  );
  const state = await page.evaluate(() => window.__meydanCallState ?? null);
  record(`${label} peer connection`, state?.peers[0]?.connectionState ?? "missing");
}

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    // Two isolated contexts must resolve each other's host candidates.
    "--disable-features=WebRtcHideLocalIpsWithMdns",
  ],
});

let contextA;
let contextB;

try {
  contextA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  contextB = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  trackPageErrors(pageA, "elif");
  trackPageErrors(pageB, "mert");

  let channelUrl = "";

  await step("elif girişi", async () => {
    await login(pageA, "elif");
  });

  await step("elif aynı kanalı açar", async () => {
    await pageA.getByText("RavenMUN").first().click();
    await pageA.waitForURL(/\/sunucu\/[^/]+\/[^/]+/u, { timeout: 20_000 });
    channelUrl = pageA.url();
    await pageA.getByRole("button", { name: JOIN_LABEL }).waitFor({
      state: "visible",
      timeout: 20_000,
    });
  });

  await step("mert girişi ve aynı kanal", async () => {
    await login(pageB, "mert");
    await pageB.goto(channelUrl, { waitUntil: "domcontentloaded" });
    await pageB.getByRole("button", { name: JOIN_LABEL }).waitFor({
      state: "visible",
      timeout: 20_000,
    });
  });

  await step("iki kullanıcı sesli sohbete katılır", async () => {
    // Playwright waits for the button to leave its socket-connecting
    // disabled state before clicking.
    await pageA.getByRole("button", { name: JOIN_LABEL }).click({
      timeout: 30_000,
    });
    await pageB.getByRole("button", { name: JOIN_LABEL }).click({
      timeout: 30_000,
    });

    await Promise.all([
      pageA.getByText("2 kişi görüşmede", { exact: true }).waitFor({
        timeout: 20_000,
      }),
      pageB.getByText("2 kişi görüşmede", { exact: true }).waitFor({
        timeout: 20_000,
      }),
    ]);
  });

  await step("eş bağlantısı connected", async () => {
    await waitForConnectedPeer(pageA, "elif");
    await waitForConnectedPeer(pageB, "mert");
  });

  await step("ayrılınca diğer tarafta sayaç düşer", async () => {
    await pageA.getByRole("button", { name: "Ayrıl" }).click();

    await pageB.getByText("1 kişi görüşmede", { exact: true }).waitFor({
      timeout: 15_000,
    });
    await pageA.getByRole("button", { name: JOIN_LABEL }).waitFor({
      state: "visible",
      timeout: 15_000,
    });

    await pageA.waitForFunction(
      () => window.__meydanCallState?.joined === false,
      null,
      { timeout: 10_000 },
    );
    await pageB.waitForFunction(
      () => window.__meydanCallState?.participantCount === 1,
      null,
      { timeout: 10_000 },
    );

    const stateB = await pageB.evaluate(() => window.__meydanCallState ?? null);
    report.result = {
      remainingParticipantCount: stateB?.participantCount ?? null,
      remainingPeers: stateB?.peers.length ?? null,
    };
  });

  if (report.pageErrors.length > 0) {
    throw new Error(`Sayfa hataları: ${report.pageErrors.join(" | ")}`);
  }

  record("e2e tamamlandı");
} catch (error) {
  report.result = { ok: false, error: String(error) };
  process.exitCode = 1;
} finally {
  await contextA?.close().catch(() => undefined);
  await contextB?.close().catch(() => undefined);
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}
