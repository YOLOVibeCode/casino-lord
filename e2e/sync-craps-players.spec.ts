import { expect, test } from "@playwright/test";
import {
  closeBetsIfOpen,
  closeSyncedSession,
  expectDisplaySettlement,
  openBets,
  parseBankroll,
  recordCrapsTotal,
  setupSyncedTable,
} from "./helpers.js";

test("sync craps with two players, pass-line bets, and come-out 7 settlement", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const session = await setupSyncedTable(browser, {
    game: "craps",
    withPlayers: true,
    houseBank: true,
    players: [
      { name: "Ana", color: "#E53935" },
      { name: "Ben", color: "#FB8C00" },
    ],
  });
  const { dealer, display, players } = session;
  const [ana, ben] = players;
  if (!ana || !ben) throw new Error("expected two player pages");

  await expect(ana.getByTestId("craps-player-view")).toBeVisible();
  await expect(ben.getByTestId("craps-player-view")).toBeVisible();
  await expect(ana.getByTestId("player-status")).toContainText(/Shooter:/);

  const anaBefore = parseBankroll(await ana.getByTestId("player-bankroll").textContent());
  const benBefore = parseBankroll(await ben.getByTestId("player-bankroll").textContent());

  await openBets(dealer);
  await ana.getByTestId("chip-denom-100").click();
  await ana.getByTestId("bet-zone-pass").click();
  await ben.getByTestId("chip-denom-100").click();
  await ben.getByTestId("bet-zone-pass").click();
  await closeBetsIfOpen(dealer);

  await recordCrapsTotal(dealer, 7);

  await expect
    .poll(async () => parseBankroll(await ana.getByTestId("player-bankroll").textContent()))
    .toBeGreaterThan(anaBefore);
  await expect
    .poll(async () => parseBankroll(await ben.getByTestId("player-bankroll").textContent()))
    .toBeGreaterThan(benBefore);

  await expectDisplaySettlement(display, "Ana", "win");
  await expectDisplaySettlement(display, "Ben", "win");
  await expect(display.getByTestId("display-view")).toBeVisible();

  await closeSyncedSession(session);
});
