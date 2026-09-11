import { expect, test } from "@playwright/test";
import {
  closeBetsIfOpen,
  closeSyncedSession,
  expectDisplaySettlement,
  openBets,
  placeFeltBet,
  recordBlackjackQuick,
  setupSyncedTable,
  waitForBankroll,
} from "./helpers.js";

test("sync blackjack with two seated players and quick-entry settlement", async ({ browser }) => {
  test.setTimeout(90_000);
  const session = await setupSyncedTable(browser, {
    game: "blackjack",
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

  await ana.getByTestId("seat-pick-1").click();
  await ben.getByTestId("seat-pick-2").click();
  await expect(ana.getByTestId("my-seat-panel")).toContainText("SEAT 1");
  await expect(ben.getByTestId("my-seat-panel")).toContainText("SEAT 2");

  await openBets(dealer);
  await placeFeltBet(ana, "felt-zone-main");
  await placeFeltBet(ben, "felt-zone-main");
  await closeBetsIfOpen(dealer);

  await recordBlackjackQuick(dealer, "17");

  await waitForBankroll(ana, 400);
  await waitForBankroll(ben, 400);
  await expect(ana.getByTestId("player-status-bar")).toContainText(/-|Dealer/, { timeout: 10_000 });
  await expectDisplaySettlement(display, "Ana", "lose", ana);
  await expect(display.getByTestId("display-view")).toBeVisible();

  await closeSyncedSession(session);
});
