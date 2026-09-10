import { expect, test } from "@playwright/test";
import {
  createTable,
  prepareForScreenshot,
  recordBaccaratQuick,
  screenshotOptions,
  startFreshSolo,
} from "./helpers.js";

const VISUAL_SEQUENCE = ["P", "B", "P", "B", "T", "B"] as const;

async function seedBaccaratDisplay(page: import("@playwright/test").Page): Promise<void> {
  await startFreshSolo(page, "baccarat");
  await recordBaccaratQuick(page, [...VISUAL_SEQUENCE]);
  await page.getByTestId("display-shell").waitFor();
}

test.describe("visual regression", () => {
  test("display shell at 1280x720", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await seedBaccaratDisplay(page);
    await prepareForScreenshot(page);

    await expect(page.getByTestId("display-shell")).toHaveScreenshot(
      "display-1280x720.png",
      screenshotOptions(page),
    );
  });

  test("display shell at 1920x1080", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await seedBaccaratDisplay(page);
    await prepareForScreenshot(page);

    await expect(page.getByTestId("display-shell")).toHaveScreenshot(
      "display-1920x1080.png",
      screenshotOptions(page),
    );
  });

  test("dealer shell at 390x844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startFreshSolo(page, "baccarat");
    await prepareForScreenshot(page);

    await expect(page.getByTestId("dealer-shell")).toHaveScreenshot(
      "dealer-390x844.png",
      screenshotOptions(page),
    );
  });

  test("player shell at 360x780", async ({ browser }) => {
    const landing = await browser.newPage();
    const { code, dealerToken } = await createTable(landing, {
      withPlayers: true,
      houseBank: true,
    });
    await landing.close();

    const player = await browser.newPage();
    await player.setViewportSize({ width: 360, height: 780 });
    await player.goto(`/play/${code}`);
    await player.getByTestId("player-name-input").fill("Ana");
    await player.getByTestId("color-#E53935").click();
    await player.getByTestId("join-btn").click();

    const dealer = await browser.newPage();
    await dealer.goto(`/dealer/${code}?t=${encodeURIComponent(dealerToken)}`);
    if (
      await player
        .getByTestId("pending-message")
        .isVisible()
        .catch(() => false)
    ) {
      await dealer.getByTestId("players-btn").click();
      await dealer.locator('[data-testid^="approve-"]').first().click();
    }
    await player.getByTestId("player-shell").waitFor({ timeout: 10_000 });
    await prepareForScreenshot(player);

    await expect(player.getByTestId("player-shell")).toHaveScreenshot(
      "player-360x780.png",
      screenshotOptions(player),
    );

    await player.close();
    await dealer.close();
  });
});
