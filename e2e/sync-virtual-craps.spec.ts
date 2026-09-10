import { expect, test } from "@playwright/test";
import {
  closeBetsIfOpen,
  closeSyncedSession,
  expectDisplaySettlement,
  openBets,
  parseBankroll,
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
  await closeBetsIfOpen(dealer);

  const settlement = expectDisplaySettlement(display, "Ana", "nonzero", ana, 160_000);
  const afterBet = parseBankroll(await ana.getByTestId("player-bankroll").textContent());

  for (let i = 0; i < 16; i += 1) {
    const strip =
      (await display
        .getByTestId("betting-strip")
        .locator(".betting-strip__status")
        .textContent()) ?? "";
    const bankroll = parseBankroll(await ana.getByTestId("player-bankroll").textContent());
    if (/Ana (?:\+[1-9]|-)/.test(strip) || bankroll !== afterBet) {
      break;
    }

    await expect(ana.getByTestId("shooter-roll")).toBeVisible();
    await triggerVirtualDeal(dealer);
    await waitForNextVirtualResult(dealer);
  }

  await settlement;
  await expect(display.getByTestId("virtual-board-tag")).toBeVisible();
  await expect(display.getByTestId("last-roll-dice")).toBeVisible();

  await closeSyncedSession(session);
});
