import { expect, test } from "@playwright/test";
import { createTable, waitForVirtualReveal } from "./helpers.js";

test("dealer-only virtual baccarat shows VIRTUAL tag after two deals", async ({ browser }) => {
  const landing = await browser.newPage();
  const { code, dealerToken } = await createTable(landing, { virtual: true });
  await landing.close();

  const dealer = await browser.newPage();
  const display = await browser.newPage();

  await dealer.goto(`/dealer/${code}?t=${encodeURIComponent(dealerToken)}`);
  await dealer.getByTestId("dealer-shell").waitFor();

  await display.goto(`/display/${code}`);
  await display.getByTestId("display-shell").waitFor();

  await expect(display.getByTestId("virtual-board-tag")).toHaveText("VIRTUAL");

  for (let i = 0; i < 2; i += 1) {
    await dealer.getByTestId("deal-btn").click();
    await waitForVirtualReveal(dealer);
    await waitForVirtualReveal(display);
  }

  await expect(display.getByTestId("virtual-board-tag")).toBeVisible();
  await expect(dealer.getByTestId("deal-btn")).toBeVisible();

  await dealer.close();
  await display.close();
});
