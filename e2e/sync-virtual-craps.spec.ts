import { expect, test } from "@playwright/test";
import {
  closeBetsIfOpen,
  closeSyncedSession,
  expectDisplaySettlement,
  openBets,
  setupSyncedTable,
  triggerVirtualDeal,
  waitForNextVirtualResult,
} from "./helpers.js";

test("sync virtual craps shooter rolls until pass-line settlement", async ({ browser }) => {
  test.setTimeout(180_000);

  const session = await setupSyncedTable(browser, {
    game: "craps",
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
  await expect(ana.getByTestId("shooter-prompt")).toContainText("YOU HAVE THE DICE");
  await expect(ana.getByTestId("shooter-controls")).toBeVisible();
  await expect(ben.getByTestId("shooter-controls")).toHaveCount(0);

  await openBets(dealer);
  await ana.getByTestId("chip-denom-100").click();
  await ana.getByTestId("bet-zone-pass").click();
  await ben.getByTestId("chip-denom-100").click();
  await ben.getByTestId("bet-zone-pass").click();
  const passDecided = /NATURAL|CRAPS|POINT MADE|SEVEN OUT/i;
  for (let i = 0; i < 16; i += 1) {
    await closeBetsIfOpen(dealer);
    await expect(ana.getByTestId("shooter-roll")).toBeVisible();
    await triggerVirtualDeal(dealer);
    await waitForNextVirtualResult(dealer);
    const last = (await dealer.getByTestId("virtual-last-result").textContent()) ?? "";
    if (passDecided.test(last)) {
      await expectDisplaySettlement(display, "Ana", "nonzero", ana, 10_000);
      break;
    }
  }

  await expect(dealer.getByTestId("virtual-last-result")).toContainText(passDecided);
  await expect(display.getByTestId("virtual-board-tag")).toBeVisible();
  await expect(display.getByTestId("last-roll-dice")).toBeVisible();

  await closeSyncedSession(session);
});
