import { expect, test } from "@playwright/test";
import {
  closeBetsIfOpen,
  closeSyncedSession,
  completeVirtualBlackjackHand,
  expectDisplaySettlement,
  openBets,
  placeFeltBet,
  setupSyncedTable,
  waitForVirtualResult,
} from "./helpers.js";

test("sync virtual blackjack deals seat 1 and settles after the turn", async ({ browser }) => {
  test.setTimeout(150_000);

  const session = await setupSyncedTable(browser, {
    game: "blackjack",
    withPlayers: true,
    houseBank: true,
    virtual: true,
    players: [
      { name: "Ana", color: "#E53935" },
      { name: "Ben", color: "#FB8C00" },
    ],
  });
  const { dealer, display, players } = session;
  const [ana, ben] = players;
  if (!ana || !ben) throw new Error("expected two player pages");

  await expect(display.getByTestId("virtual-board-tag")).toHaveText("VIRTUAL");
  await expect(dealer.getByTestId("deal-btn")).toHaveText("DEAL");

  await ana.getByTestId("seat-pick-1").click();
  await ben.getByTestId("seat-pick-2").click();
  await expect(ana.getByTestId("my-seat-panel")).toContainText("SEAT 1");

  await openBets(dealer);
  await placeFeltBet(ana, "felt-zone-main");
  await placeFeltBet(ben, "felt-zone-main");
  await closeBetsIfOpen(dealer);

  const settlement = expectDisplaySettlement(display, "Ana", "any", ana, 120_000);
  await completeVirtualBlackjackHand(dealer, ana);
  await waitForVirtualResult(dealer);
  await settlement;
  await expect(display.getByTestId("virtual-board-tag")).toBeVisible();
  await expect(display.getByTestId("display-view")).toBeVisible();

  await closeSyncedSession(session);
});
