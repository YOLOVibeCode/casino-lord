import { expect, test } from "@playwright/test";
import { dealerPane, displayStatValue, recordBaccaratQuick, startFreshSolo } from "./helpers.js";

test.describe("solo smoke", () => {
  test("baccarat records P/B/T and updates board stats", async ({ page }) => {
    await startFreshSolo(page, "baccarat");

    await recordBaccaratQuick(page, ["P", "B", "T"]);

    expect(await displayStatValue(page, "Player")).toBe("1");
    expect(await displayStatValue(page, "Banker")).toBe("1");
    expect(await displayStatValue(page, "Tie")).toBe("1");
  });

  test("roulette records three numbers", async ({ page }) => {
    await page.goto("/solo/roulette");
    await page.getByTestId("dealer-shell").waitFor();

    for (const pocket of ["17", "0", "32"]) {
      await dealerPane(page).getByTestId(`number-cell-${pocket}`).click();
      await page.getByTestId("confirm-btn").click();
    }

    const history = dealerPane(page).getByTestId("dealer-history-strip");
    await expect(history.locator(".dealer-view__chip:not(.dealer-view__chip--void)")).toHaveCount(
      3,
    );
  });

  test("craps come-out 7 then point 6 shows PUCK ON 6", async ({ page }) => {
    await page.goto("/solo/craps");
    await page.getByTestId("dealer-shell").waitFor();

    const pane = dealerPane(page);
    await pane.getByTestId("total-mode-toggle").click();
    await pane.getByTestId("outcome-chip-t7").click();
    await pane.getByTestId("outcome-chip-t6").click();

    await expect(pane.getByTestId("dealer-puck")).toHaveText(/PUCK: ON 6/);
  });

  test("blackjack resolves one hand via quick entry", async ({ page }) => {
    await page.goto("/solo/blackjack");
    await page.getByTestId("dealer-shell").waitFor();

    await dealerPane(page).getByTestId("outcome-chip-17").click();

    expect(await displayStatValue(page, "Rounds this shoe")).toBe("1");
    await expect(page.getByTestId("display-view")).toBeVisible();
  });
});
