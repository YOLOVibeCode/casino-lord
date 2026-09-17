import { expect, test, type Locator, type Page } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import QRCode from "qrcode";
import { createTable } from "./helpers.js";

/**
 * Onboarding: every way a person gets into a table.
 *
 * The other sync specs join players by navigating straight to `/play/:code`,
 * which never exercises the thing a guest actually does — point a camera at a
 * QR code. These tests decode the rendered QR the way a phone would and then
 * open what it says, so a QR aimed at an unreachable or wrong target fails here.
 */

/** Decode a rendered `qrDataUrl` image exactly as a phone camera would. */
async function scanQr(image: Locator): Promise<string> {
  const src = await image.getAttribute("src");
  expect(src, "QR image has no source").toMatch(/^data:image\/png;base64,/);
  const png = PNG.sync.read(Buffer.from(src!.split(",")[1]!, "base64"));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded, "QR image could not be scanned").not.toBeNull();
  return decoded!.data;
}

async function expectQrPngEncodes(image: Locator, url: string): Promise<void> {
  expect(
    await scanQr(image),
    `scanning this QR does not lead to ${url} — a phone lands somewhere else`,
  ).toBe(url);
}

/**
 * The TV badge renders an inline SVG. Its path data is a pure function of the
 * payload, so an identical path proves an identical target.
 * Keep the options in sync with `qrSvg` in apps/web/src/sync/qr.ts.
 */
function svgPathData(svg: string): string {
  return svg.match(/\sd="([^"]+)"/)?.[1] ?? "";
}

async function expectQrSvgEncodes(host: Locator, url: string): Promise<void> {
  const rendered = svgPathData(await host.innerHTML());
  const expected = svgPathData(await QRCode.toString(url, { type: "svg", margin: 1, width: 64 }));
  expect(expected).not.toBe("");
  expect(rendered, `QR badge does not encode ${url}`).toBe(expected);
}

async function joinFromScannedUrl(page: Page, qrUrl: string, name: string): Promise<void> {
  await page.goto(qrUrl);
  await page.getByTestId("player-name-input").waitFor({ timeout: 15_000 });
  await page.getByTestId("player-name-input").fill(name);
  await page.getByTestId("join-btn").click();
  await page.getByTestId("player-shell").waitFor({ timeout: 15_000 });
}

test.describe("onboarding by QR", () => {
  test("a guest scans the Join QR on the created screen and reaches the table", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const host = await browser.newPage();
    const { code, dealerToken } = await createTable(host, { withPlayers: true, houseBank: true });

    // Go where the QR actually points, not where we assume it points.
    const joinUrl = await scanQr(host.getByTestId("play-qr"));
    expect(joinUrl).toBe(new URL(`/play/${code}`, host.url()).toString());
    // The QR, the copy button and the "open here" link must all agree.
    expect(await host.getByTestId("open-play").getAttribute("href")).toBe(joinUrl);

    const dealer = await browser.newPage();
    await dealer.goto(`/dealer/${code}?t=${encodeURIComponent(dealerToken)}`);
    await dealer.getByTestId("dealer-shell").waitFor();

    const guest = await browser.newPage();
    await joinFromScannedUrl(guest, joinUrl, "Ana");

    await dealer.getByTestId("players-btn").click();
    await expect(dealer.getByTestId("players-dialog")).toContainText("Ana");

    await host.close();
    await dealer.close();
    await guest.close();
  });

  test("the dealer and display QRs open their own roles", async ({ browser }) => {
    test.setTimeout(90_000);
    const host = await browser.newPage();
    const { code } = await createTable(host, { withPlayers: true });

    const displayUrl = new URL(`/display/${code}`, host.url()).toString();
    await expectQrPngEncodes(host.getByTestId("display-qr"), displayUrl);

    const dealerHref = await host.getByTestId("open-dealer").getAttribute("href");
    expect(dealerHref).toContain(`/dealer/${code}`);
    expect(dealerHref).toContain("?t=");
    await expectQrPngEncodes(host.getByTestId("dealer-qr"), dealerHref!);

    const tv = await browser.newPage();
    await tv.goto(displayUrl);
    await expect(tv.getByTestId("display-shell")).toBeVisible();

    const phone = await browser.newPage();
    await phone.goto(dealerHref!);
    await expect(phone.getByTestId("dealer-shell")).toBeVisible();

    await host.close();
    await tv.close();
    await phone.close();
  });

  test("the dealer's in-game Show QR offers a working Join code", async ({ browser }) => {
    test.setTimeout(90_000);
    const host = await browser.newPage();
    const { code, dealerToken } = await createTable(host, { withPlayers: true });
    await host.close();

    const dealer = await browser.newPage();
    await dealer.goto(`/dealer/${code}?t=${encodeURIComponent(dealerToken)}`);
    await dealer.getByTestId("dealer-shell").waitFor();

    await dealer.getByTestId("menu-btn").click();
    await dealer.getByTestId("menu-show-qr").click();
    const dialog = dealer.getByTestId("qr-dialog");
    await expect(dialog).toBeVisible();

    // Mid-game this dialog is what the dealer holds up for late arrivals.
    await expect(dialog).toContainText("Join (Player)");
    const joinUrl = await scanQr(dialog.getByTestId("qr-image").first());
    expect(joinUrl).toBe(new URL(`/play/${code}`, dealer.url()).toString());

    const guest = await browser.newPage();
    await joinFromScannedUrl(guest, joinUrl, "Ben");

    await dealer.close();
    await guest.close();
  });

  test("the TV's join badge encodes the join URL and disappears when joining closes", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const host = await browser.newPage();
    const { code, dealerToken } = await createTable(host, { withPlayers: true });
    await host.close();

    const dealer = await browser.newPage();
    await dealer.goto(`/dealer/${code}?t=${encodeURIComponent(dealerToken)}`);
    await dealer.getByTestId("dealer-shell").waitFor();

    const tv = await browser.newPage();
    await tv.goto(`/display/${code}`);
    await tv.getByTestId("display-shell").waitFor();

    const badge = tv.getByTestId("display-qr-badge").locator(".qr-badge__image");
    await expect(badge).toBeVisible();
    await expectQrSvgEncodes(badge, new URL(`/play/${code}`, tv.url()).toString());
    await expect(tv.getByTestId("display-qr-badge")).toContainText(code);

    await dealer.getByTestId("players-btn").click();
    await dealer.getByTestId("toggle-joining").click();
    await expect(tv.getByTestId("display-qr-badge")).toBeHidden({ timeout: 10_000 });

    await dealer.close();
    await tv.close();
  });

  test("a reissued link puts a player straight back in with no name form", async ({ browser }) => {
    test.setTimeout(90_000);
    const host = await browser.newPage();
    const { code, dealerToken } = await createTable(host, { withPlayers: true, houseBank: true });
    const joinUrl = new URL(`/play/${code}`, host.url()).toString();
    await host.close();

    const dealer = await browser.newPage();
    await dealer.goto(`/dealer/${code}?t=${encodeURIComponent(dealerToken)}`);
    await dealer.getByTestId("dealer-shell").waitFor();

    const guest = await browser.newPage();
    await joinFromScannedUrl(guest, joinUrl, "Ana");

    await dealer.getByTestId("players-btn").click();
    await dealer.locator('[data-testid^="reissue-"]').first().click();
    await expect(dealer.getByTestId("reissue-qr")).toBeVisible();
    await expect(dealer.getByTestId("reissue-warning")).toContainText("can join as this player");

    const reissuedUrl = await dealer.getByTestId("reissue-link").getAttribute("href");
    expect(reissuedUrl).toContain("?t=");
    await expectQrPngEncodes(dealer.getByTestId("reissue-qr").locator("img"), reissuedUrl!);

    // A fresh device (no stored token) must land in the table, not on the form.
    const replacement = await browser.newContext();
    const replacementPage = await replacement.newPage();
    await replacementPage.goto(reissuedUrl!);
    await expect(replacementPage.getByTestId("player-shell")).toBeVisible({ timeout: 15_000 });
    await expect(replacementPage.getByTestId("player-name-input")).toHaveCount(0);
    // The token is not left sitting in the address bar for a shoulder-surfer.
    await expect.poll(async () => replacementPage.url()).not.toContain("?t=");

    await dealer.close();
    await guest.close();
    await replacement.close();
  });
});

test.describe("onboarding without a QR", () => {
  test("a guest joins by typing the table code on the landing page", async ({ browser }) => {
    test.setTimeout(90_000);
    const host = await browser.newPage();
    const { code } = await createTable(host, { withPlayers: true });
    await host.close();

    const guest = await browser.newPage();
    await guest.goto("/");
    await guest.getByRole("button", { name: "Join", exact: true }).click();
    await guest.getByTestId("join-code-input").fill(code.toLowerCase());
    await guest.getByRole("button", { name: "Continue" }).click();
    await guest.getByTestId("join-player").click();

    await guest.getByTestId("player-name-input").fill("Cara");
    await guest.getByTestId("join-btn").click();
    await expect(guest.getByTestId("player-shell")).toBeVisible({ timeout: 15_000 });

    await guest.close();
  });

  test("a returning player reloads back into the table", async ({ browser }) => {
    test.setTimeout(90_000);
    const host = await browser.newPage();
    const { code } = await createTable(host, { withPlayers: true });
    const joinUrl = new URL(`/play/${code}`, host.url()).toString();
    await host.close();

    const guest = await browser.newPage();
    await joinFromScannedUrl(guest, joinUrl, "Dee");

    await guest.reload();
    await expect(guest.getByTestId("player-shell")).toBeVisible({ timeout: 15_000 });
    await expect(guest.getByTestId("player-name-input")).toHaveCount(0);

    await guest.close();
  });

  test("a second guest cannot take a colour that is already in use", async ({ browser }) => {
    test.setTimeout(90_000);
    const host = await browser.newPage();
    const { code } = await createTable(host, { withPlayers: true });
    const joinUrl = new URL(`/play/${code}`, host.url()).toString();
    await host.close();

    const first = await browser.newPage();
    await first.goto(joinUrl);
    await first.getByTestId("player-name-input").fill("Ana");
    const takenColor = await first
      .locator(".play-page__swatch--selected")
      .getAttribute("data-testid");
    await first.getByTestId("join-btn").click();
    await first.getByTestId("player-shell").waitFor({ timeout: 15_000 });

    const second = await browser.newContext();
    const secondPage = await second.newPage();
    await secondPage.goto(joinUrl);
    await secondPage.getByTestId("player-name-input").waitFor({ timeout: 15_000 });
    await expect(secondPage.getByTestId(takenColor!)).toBeDisabled();
    await expect(secondPage.locator(".play-page__swatch--selected")).not.toHaveAttribute(
      "data-testid",
      takenColor!,
    );

    await first.close();
    await second.close();
  });
});

test.describe("onboarding dead ends explain themselves", () => {
  test("a dealer-only table tells a scanning guest, and offers the display", async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const host = await browser.newPage();
    const { code } = await createTable(host, { withPlayers: false });

    // No join QR is offered at all on a dealer-only table.
    await expect(host.getByTestId("play-qr")).toHaveCount(0);
    await expect(host.getByTestId("table-created-next-steps")).not.toContainText("Players scan");
    await host.close();

    const guest = await browser.newPage();
    await guest.goto(`/play/${code}`);
    await expect(guest.getByTestId("play-error-code")).toHaveText("PLAYERS_DISABLED", {
      timeout: 15_000,
    });
    await guest.getByTestId("play-error-action-display").click();
    await expect(guest.getByTestId("display-shell")).toBeVisible({ timeout: 15_000 });

    await guest.close();
  });

  test("a stale or mistyped code says so instead of hanging", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/play/ZZZZZZ");
    await expect(page.getByTestId("play-error-code")).toHaveText("NOT_FOUND", { timeout: 15_000 });

    await page.goto("/play/nope");
    await expect(page.getByTestId("play-error-code")).toHaveText("INVALID_TABLE_CODE", {
      timeout: 15_000,
    });
  });

  test("a guest who scans after joining closes is told why", async ({ browser }) => {
    test.setTimeout(90_000);
    const host = await browser.newPage();
    const { code, dealerToken } = await createTable(host, { withPlayers: true });
    const joinUrl = new URL(`/play/${code}`, host.url()).toString();
    await host.close();

    const dealer = await browser.newPage();
    await dealer.goto(`/dealer/${code}?t=${encodeURIComponent(dealerToken)}`);
    await dealer.getByTestId("dealer-shell").waitFor();
    await dealer.getByTestId("players-btn").click();
    await dealer.getByTestId("toggle-joining").click();
    await expect(dealer.getByTestId("toggle-joining")).toHaveText("Open joining");

    const guest = await browser.newPage();
    await guest.goto(joinUrl);
    await guest.getByTestId("player-name-input").fill("Late");
    await guest.getByTestId("join-btn").click();
    await expect(guest.getByTestId("play-join-error-code")).toHaveText("JOINING_CLOSED", {
      timeout: 15_000,
    });

    await dealer.close();
    await guest.close();
  });
});
