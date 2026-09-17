import { expect, test } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import type { BrowserContext, Locator } from "@playwright/test";
import { createTable, startFreshSolo } from "./helpers.js";

/**
 * Reproductions for "I scanned the QR and got a timeout".
 *
 * Each test drives the app the way the person did, so the timeout is produced by
 * the product, not simulated by the test.
 */

async function scanQr(image: Locator): Promise<string> {
  const src = await image.getAttribute("src");
  expect(src, "QR image has no source").toMatch(/^data:image\/png;base64,/);
  const png = PNG.sync.read(Buffer.from(src!.split(",")[1]!, "base64"));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded, "QR image could not be scanned").not.toBeNull();
  return decoded!.data;
}

/**
 * Kill the live socket the way a hostile network does: the websocket upgrade is
 * swallowed (never reaches the server) and the polling fallback is refused.
 * `route` alone does not touch websockets, so both are needed.
 */
async function blackholeLiveSocket(context: BrowserContext): Promise<void> {
  await context.routeWebSocket("**/ws/**", () => {
    // Intentionally never call connectToServer(): the socket hangs open forever.
  });
  await context.route("**/ws/**", (route) => route.abort());
}

test.describe("solo QR scanned from another device", () => {
  test("times out after 5s with no way to recover", async ({ browser }) => {
    test.setTimeout(90_000);

    const hostContext = await browser.newContext();
    const host = await hostContext.newPage();
    await startFreshSolo(host, "baccarat");

    await host.getByTestId("local-players-toggle").locator("input").check();
    await expect(host.getByTestId("solo-local-links")).toBeVisible();

    const playUrl = await scanQr(host.getByTestId("solo-play-qr"));
    expect(playUrl).toContain("/solo/baccarat/play?code=");

    // A different device is a different browser: BroadcastChannel cannot reach
    // the host tab, which is the whole premise of solo mode.
    const phoneContext = await browser.newContext();
    const phone = await phoneContext.newPage();
    await phone.goto(playUrl);

    await phone.getByTestId("player-name-input").waitFor({ timeout: 15_000 });
    await phone.getByTestId("player-name-input").fill("Ana");
    await phone.getByTestId("join-btn").click();

    const error = phone.locator(".play-page__error");
    await expect(error).toContainText("TIMEOUT", { timeout: 20_000 });

    await hostContext.close();
    await phoneContext.close();
  });
});

test.describe("synced table when the live socket never connects", () => {
  // KNOWN BUG — remove `.fixme` with the fix.
  //
  // #94 made a player enter the table after the 8s join timeout instead of being
  // stuck on the name form. With a socket that never connects at all, that path
  // renders a page whose <main> contains exactly one element:
  //
  //   <p data-testid="entered-on-timeout">Joined — still connecting to the live table</p>
  //
  // PlayerShell and the diagnostics panel produce no DOM, so there is no shell,
  // no "Loading…", no diagnostics to copy and no way back. PlayerShell has a
  // `if (!module)` fallback that never gets the chance to render.
  test.fixme("a player still gets in over HTTP and is told it is still connecting", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const host = await browser.newPage();
    const { code } = await createTable(host, { withPlayers: true });
    const joinUrl = new URL(`/play/${code}`, host.url()).toString();
    await host.close();

    // Everything but the live socket works — a captive portal, a proxy that drops
    // upgrades, a phone on a carrier NAT.
    const phoneContext = await browser.newContext();
    await blackholeLiveSocket(phoneContext);
    const phone = await phoneContext.newPage();

    await phone.goto(joinUrl);
    await phone.getByTestId("player-name-input").waitFor({ timeout: 20_000 });
    await phone.getByTestId("player-name-input").fill("Ana");
    await phone.getByTestId("join-btn").click();

    await expect(phone.getByTestId("player-shell")).toBeVisible({ timeout: 30_000 });
    await expect(phone.getByTestId("entered-on-timeout")).toBeVisible();

    await phoneContext.close();
  });

  test("a dealer opening a fresh table hits the join timeout", async ({ browser }) => {
    test.setTimeout(120_000);

    const host = await browser.newPage();
    const { code, dealerToken } = await createTable(host, { withPlayers: true });
    await host.close();

    const dealerContext = await browser.newContext();
    await blackholeLiveSocket(dealerContext);
    const dealer = await dealerContext.newPage();

    await dealer.goto(`/dealer/${code}?t=${encodeURIComponent(dealerToken)}`);

    await expect(dealer.getByText("Connection timed out")).toBeVisible({ timeout: 30_000 });

    await dealerContext.close();
  });
});
