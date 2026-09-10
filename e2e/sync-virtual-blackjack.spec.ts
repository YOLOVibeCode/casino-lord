import { expect, test } from "@playwright/test";
import {
  closeBetsIfOpen,
  closeSyncedSession,
  expectDisplaySettlement,
  openBets,
  placeFeltBet,
  setupSyncedTable,
  triggerVirtualDeal,
  waitForVirtualReveal,
} from "./helpers.js";

test("sync virtual blackjack deals seat 1 and settles after the turn", async ({ browser }) => {
  test.setTimeout(90_000);

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

  for (let i = 0; i < 14; i += 1) {
    const status =
      (await display
        .getByTestId("betting-strip")
        .locator(".betting-strip__status")
        .textContent()) ?? "";
    if (/Ana [+-]\d/.test(status)) break;

    const stand = ana.getByTestId("action-btn-stand");
    if (
      (await stand.isVisible().catch(() => false)) &&
      (await stand.isEnabled().catch(() => false))
    ) {
      await expect(ana.getByTestId("turn-prompt")).toContainText("YOUR MOVE");
      await stand.click();
      await waitForVirtualReveal(display);
      continue;
    }

    const deal = dealer.getByTestId("deal-btn");
    if (await deal.isEnabled().catch(() => false)) {
      await triggerVirtualDeal(dealer, display);
      continue;
    }

    await display.waitForTimeout(400);
  }

  await expectDisplaySettlement(display, "Ana", "any");
  await expect(display.getByTestId("virtual-board-tag")).toBeVisible();
  await expect(display.getByTestId("display-view")).toBeVisible();

  await closeSyncedSession(session);
});
