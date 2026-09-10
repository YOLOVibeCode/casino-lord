import { expect, test } from "@playwright/test";
import {
  closeBetsIfOpen,
  closeSyncedSession,
  expectDisplaySettlement,
  openBets,
  parseBankroll,
  placeFeltBet,
  recordRoulettePocket,
  setupSyncedTable,
} from "./helpers.js";

test("sync roulette with two players, red bets, and physical 32 settlement", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const session = await setupSyncedTable(browser, {
    game: "roulette",
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

  await expect(ana.getByTestId("roulette-player-view")).toBeVisible();
  await expect(ben.getByTestId("roulette-player-view")).toBeVisible();

  const anaBefore = parseBankroll(await ana.getByTestId("player-bankroll").textContent());
  const benBefore = parseBankroll(await ben.getByTestId("player-bankroll").textContent());

  await openBets(dealer);
  await placeFeltBet(ana, "felt-zone-red");
  await placeFeltBet(ben, "felt-zone-red");
  await closeBetsIfOpen(dealer);

  await recordRoulettePocket(dealer, "32");

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
