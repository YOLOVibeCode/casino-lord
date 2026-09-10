import { expect, test } from "@playwright/test";
import {
  closeBetsIfOpen,
  closeSyncedSession,
  expectDisplaySettlement,
  openBets,
  placeFeltBet,
  setupSyncedTable,
  triggerVirtualDeal,
  waitForVirtualResult,
} from "./helpers.js";

test("sync virtual roulette with two players settles a red spin", async ({ browser }) => {
  test.setTimeout(90_000);
  const session = await setupSyncedTable(browser, {
    game: "roulette",
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
  await expect(dealer.getByTestId("deal-btn")).toHaveText("SPIN");

  await openBets(dealer);
  await placeFeltBet(ana, "felt-zone-red");
  await placeFeltBet(ben, "felt-zone-red");
  await closeBetsIfOpen(dealer);

  await triggerVirtualDeal(dealer);
  await waitForVirtualResult(dealer);

  await expect(ana.getByTestId("player-status-bar")).toContainText(/[+-]\d/, { timeout: 10_000 });
  await expectDisplaySettlement(display, "Ana", "any", ana);
  await expect(display.getByTestId("virtual-board-tag")).toBeVisible();
  await expect(display.getByTestId("display-view")).toBeVisible();

  await closeSyncedSession(session);
});
