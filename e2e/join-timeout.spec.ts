import { expect, test } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";
import { createTable, startFreshSolo } from "./helpers.js";

/**
 * Reproductions for "I scanned the QR and got a timeout".
 *
 * Each test drives the app the way the person did, so the timeout is produced by
 * the product, not simulated by the test.
 */

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

test.describe("solo mode local players", () => {
  test("offers a link and a real table, never a QR that can only time out", async ({ browser }) => {
    test.setTimeout(90_000);

    const hostContext = await browser.newContext();
    const host = await hostContext.newPage();
    await startFreshSolo(host, "baccarat");

    await host.getByTestId("local-players-toggle").locator("input").check();
    await expect(host.getByTestId("solo-local-links")).toBeVisible();

    // Solo is one browser talking to itself over BroadcastChannel. A QR here can
    // only ever time out on the phone that scans it, so there is no QR to scan.
    await expect(host.getByTestId("solo-play-qr")).toHaveCount(0);
    await expect(host.getByTestId("solo-display-qr")).toHaveCount(0);
    await expect(host.getByTestId("solo-same-device-note")).toContainText(
      /phone cannot join a solo table/i,
    );
    expect(await host.getByTestId("solo-create-table-link").getAttribute("href")).toBe("/");

    const playUrl = await host.getByTestId("solo-play-link").getAttribute("href");
    expect(playUrl).toContain("/solo/baccarat/play?code=");

    await hostContext.close();
  });

  test("a stale solo link opened elsewhere still explains itself", async ({ browser }) => {
    test.setTimeout(90_000);

    const hostContext = await browser.newContext();
    const host = await hostContext.newPage();
    await startFreshSolo(host, "baccarat");
    await host.getByTestId("local-players-toggle").locator("input").check();
    await expect(host.getByTestId("solo-local-links")).toBeVisible();
    const playUrl = (await host.getByTestId("solo-play-link").getAttribute("href"))!;

    // Someone photographed the old QR, or the link was pasted into a chat. A
    // different browser cannot reach the host tab's BroadcastChannel.
    const phoneContext = await browser.newContext();
    const phone = await phoneContext.newPage();
    await phone.goto(playUrl);

    await phone.getByTestId("player-name-input").waitFor({ timeout: 15_000 });
    await phone.getByTestId("player-name-input").fill("Ana");
    await phone.getByTestId("join-btn").click();

    const error = phone.locator(".play-page__error");
    await expect(error).toContainText("TIMEOUT", { timeout: 20_000 });
    await expect(error).toContainText(/same browser/i);

    await hostContext.close();
    await phoneContext.close();
  });
});

test.describe("synced table when the live socket never connects", () => {
  // Regression for the blank page: #94 enters the table after the 8s join
  // timeout, which left PlayerShell rendering against an empty log. That threw
  // on `settings.bank`, so <main> held nothing but the timeout banner.
  test("a player still gets in over HTTP and is told it is still connecting", async ({
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
    // Say it is a connection problem — not that the dealer has not approved them.
    await expect(phone.getByTestId("player-connecting")).toContainText(/connecting to the table/i);
    await expect(phone.getByTestId("player-shell")).not.toContainText(/approve/i);

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
