import type { Page } from "@playwright/test";

export interface CreatedTable {
  code: string;
  dealerToken: string;
}

export interface CreateTableOptions {
  game?: "baccarat" | "roulette" | "craps" | "blackjack";
  withPlayers?: boolean;
  houseBank?: boolean;
  virtual?: boolean;
}

export function dealerPane(page: Page) {
  return page.locator('[aria-label="Dealer"]');
}

export async function dismissCardPicker(page: Page): Promise<void> {
  const backdrop = page.getByTestId("card-picker-backdrop");
  if (await backdrop.isVisible().catch(() => false)) {
    await page.getByTestId("card-picker-close").click();
    await backdrop.waitFor({ state: "hidden", timeout: 5_000 });
  }
}

export async function createTable(
  page: Page,
  options: CreateTableOptions = {},
): Promise<CreatedTable> {
  const { game = "baccarat", withPlayers = false, houseBank = false, virtual = false } = options;

  await page.goto("/");
  await page.getByRole("button", { name: "Create Table" }).click();
  await page.getByTestId("landing-sheet").waitFor();

  if (game !== "baccarat") {
    await page.locator(`input[name="game"][value="${game}"]`).check();
  }

  if (withPlayers) {
    await page.getByLabel(/With players/i).check();
    if (houseBank) {
      await page.getByTestId("house-bank-checkbox").check();
    }
  } else {
    await page.getByLabel(/Dealer only/i).check();
  }

  if (virtual) {
    await page.getByTestId("outcome-virtual").check();
  }

  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByTestId("table-created-page").waitFor();

  const url = new URL(page.url());
  const code = url.pathname.split("/").pop() ?? "";
  const dealerToken = url.searchParams.get("t") ?? "";

  return { code, dealerToken };
}

export async function recordBaccaratQuick(
  page: Page,
  outcomes: Array<"P" | "B" | "T">,
): Promise<void> {
  const pane = dealerPane(page);
  for (const outcome of outcomes) {
    await dismissCardPicker(page);
    await pane.getByTestId(`outcome-chip-${outcome}`).click({ force: true });
    await page.waitForTimeout(200);
  }
  await dismissCardPicker(page);
}

export async function waitForVirtualReveal(page: Page): Promise<void> {
  const pending = page.getByTestId("virtual-pending-ring");
  if (await pending.isVisible().catch(() => false)) {
    await pending.waitFor({ state: "hidden", timeout: 15_000 });
  }
  await page.waitForTimeout(200);
}

export async function startFreshSolo(page: Page, game: string): Promise<void> {
  await page.goto(`/solo/${game}`);
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("casino-lord");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
  await page.getByTestId("dealer-shell").waitFor();
}

export async function displayStatValue(page: Page, label: string): Promise<string> {
  const stats = await page
    .getByTestId("display-shell")
    .locator(".display-shell__stats")
    .innerText();
  const match = stats.match(new RegExp(`${label}:\\s*(\\S+)`));
  return match?.[1] ?? "";
}

export function parseBankroll(text: string | null): number {
  return Number((text ?? "0").replace(/[^\d]/g, "")) || 0;
}

export async function openBets(dealerPage: Page): Promise<void> {
  const bar = dealerPage.getByTestId("betting-bar");
  const status = bar.locator(".betting-bar__status");
  const text = (await status.textContent()) ?? "";
  if (!text.includes("BETS OPEN")) {
    await bar.click();
    await status.filter({ hasText: "BETS OPEN" }).waitFor({ timeout: 5_000 });
  }
}

export async function closeBetsIfOpen(dealerPage: Page): Promise<void> {
  const bar = dealerPage.getByTestId("betting-bar");
  const status = bar.locator(".betting-bar__status");
  const text = (await status.textContent()) ?? "";
  if (text.includes("BETS OPEN")) {
    await bar.click();
    await status.filter({ hasText: /NO MORE BETS|BETS — idle/ }).waitFor({ timeout: 5_000 });
  }
}
