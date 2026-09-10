import { expect, test } from "@playwright/test";
import { closeBetsIfOpen, createTable, openBets, parseBankroll } from "./helpers.js";

test("sync baccarat with player buy-in, bet, and banker settlement", async ({ browser }) => {
  const landing = await browser.newPage();
  const { code, dealerToken } = await createTable(landing, {
    withPlayers: true,
    houseBank: true,
  });
  await landing.close();

  const dealer = await browser.newPage();
  const display = await browser.newPage();
  const player = await browser.newPage();

  const playerName = "Ana";

  await player.goto(`/play/${code}`);
  await player.getByTestId("player-name-input").fill(playerName);
  await player.getByTestId("color-#E53935").click();
  await player.getByTestId("join-btn").click();

  await dealer.goto(`/dealer/${code}?t=${encodeURIComponent(dealerToken)}`);
  await dealer.getByTestId("dealer-shell").waitFor();

  if (
    await player
      .getByTestId("pending-message")
      .isVisible()
      .catch(() => false)
  ) {
    await dealer.getByTestId("players-btn").click();
    await dealer.getByTestId("players-dialog").waitFor();
    await dealer.locator('[data-testid^="approve-"]').first().click();
    await player.getByTestId("player-shell").waitFor({ timeout: 10_000 });
  }

  await dealer.getByTestId("bank-btn").click();
  await dealer.getByTestId("bank-panel").waitFor();
  await dealer.getByTestId("issue-one").click();
  await dealer.getByTestId("bank-panel").locator('button[aria-label="Close"]').click();

  await player.getByTestId("player-bankroll").waitFor();
  const bankrollBefore = parseBankroll(await player.getByTestId("player-bankroll").textContent());

  await display.goto(`/display/${code}`);
  await display.getByTestId("display-shell").waitFor();

  await openBets(dealer);
  await player.getByTestId("chip-denom-100").click();
  await player.getByTestId("felt-zone-banker").click();
  await player.getByTestId("bet-slip-place").click();

  await closeBetsIfOpen(dealer);
  await dealer.getByTestId("dealer-shell").click();
  await dealer.keyboard.press("B");

  await expect
    .poll(async () => parseBankroll(await player.getByTestId("player-bankroll").textContent()))
    .toBeGreaterThan(bankrollBefore);

  const strip = display.getByTestId("betting-strip");
  await expect(strip.locator(".betting-strip__status")).toContainText(
    new RegExp(`${playerName} \\+`),
    { timeout: 10_000 },
  );

  await dealer.close();
  await display.close();
  await player.close();
});
