import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  createTable,
  prepareForScreenshot,
  recordBaccaratQuick,
  recordBlackjackQuick,
  recordCrapsTotal,
  recordRoulettePocket,
  screenshotOptions,
  startFreshSolo,
} from "./helpers.js";

const VISUAL_SEQUENCE = ["P", "B", "P", "B", "T", "B"] as const;

const GAMES = ["baccarat", "roulette", "craps", "blackjack"] as const;
type VisualGame = (typeof GAMES)[number];

const OTHER_GAMES = ["roulette", "craps", "blackjack"] as const;

const DISPLAY_SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 },
] as const;

async function seedDisplay(page: Page, game: VisualGame): Promise<void> {
  await startFreshSolo(page, game);
  switch (game) {
    case "baccarat":
      await recordBaccaratQuick(page, [...VISUAL_SEQUENCE]);
      break;
    case "roulette":
      await recordRoulettePocket(page, "32");
      break;
    case "craps":
      await recordCrapsTotal(page, 7);
      await recordCrapsTotal(page, 6);
      break;
    case "blackjack":
      await recordBlackjackQuick(page, "17");
      break;
  }
  await page.getByTestId("display-shell").waitFor();
}

async function openPlayerFelt(
  browser: Browser,
  game: VisualGame,
  width: number,
  height: number,
): Promise<{ player: Page; dealer: Page }> {
  const landing = await browser.newPage();
  const { code, dealerToken } = await createTable(landing, {
    game,
    withPlayers: true,
    houseBank: true,
  });
  await landing.close();

  const player = await browser.newPage();
  await player.setViewportSize({ width, height });
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
  return { player, dealer };
}

async function expectShot(
  page: Page,
  testId: "display-shell" | "dealer-shell" | "player-shell",
  filename: string,
): Promise<void> {
  await prepareForScreenshot(page);
  await expect(page.getByTestId(testId)).toHaveScreenshot(filename, screenshotOptions(page));
}

test.describe("visual regression", () => {
  test.describe.configure({ timeout: 90_000 });

  test("display shell at 1280x720", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await seedDisplay(page, "baccarat");
    await expectShot(page, "display-shell", "display-1280x720.png");
  });

  test("display shell at 1920x1080", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await seedDisplay(page, "baccarat");
    await expectShot(page, "display-shell", "display-1920x1080.png");
  });

  test("display shell at 3840x2160", async ({ page }) => {
    await page.setViewportSize({ width: 3840, height: 2160 });
    await seedDisplay(page, "baccarat");
    await expectShot(page, "display-shell", "display-3840x2160.png");
  });

  test("dealer shell at 390x844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startFreshSolo(page, "baccarat");
    await expectShot(page, "dealer-shell", "dealer-390x844.png");
  });

  test("player shell at 360x780", async ({ browser }) => {
    const { player, dealer } = await openPlayerFelt(browser, "baccarat", 360, 780);
    await expectShot(player, "player-shell", "player-360x780.png");
    await player.close();
    await dealer.close();
  });

  test("player shell at 430x930", async ({ browser }) => {
    const { player, dealer } = await openPlayerFelt(browser, "baccarat", 430, 930);
    await expectShot(player, "player-shell", "player-430x930.png");
    await player.close();
    await dealer.close();
  });

  for (const game of OTHER_GAMES) {
    for (const { width, height } of DISPLAY_SIZES) {
      test(`${game} display shell at ${width}x${height}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await seedDisplay(page, game);
        await expectShot(page, "display-shell", `${game}-display-${width}x${height}.png`);
      });
    }

    test(`${game} dealer shell at 390x844`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await startFreshSolo(page, game);
      await expectShot(page, "dealer-shell", `${game}-dealer-390x844.png`);
    });

    test(`${game} player shell at 360x780`, async ({ browser }) => {
      const { player, dealer } = await openPlayerFelt(browser, game, 360, 780);
      await expectShot(player, "player-shell", `${game}-player-360x780.png`);
      await player.close();
      await dealer.close();
    });

    test(`${game} player shell at 430x930`, async ({ browser }) => {
      const { player, dealer } = await openPlayerFelt(browser, game, 430, 930);
      await expectShot(player, "player-shell", `${game}-player-430x930.png`);
      await player.close();
      await dealer.close();
    });
  }
});
