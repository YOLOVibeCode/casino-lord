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

  let dealerToken = url.searchParams.get("t") ?? "";
  if (!dealerToken) {
    const dealerHref = await page.getByTestId("open-dealer").getAttribute("href");
    if (dealerHref) {
      dealerToken = new URL(dealerHref, page.url()).searchParams.get("t") ?? "";
    }
  }
  if (!dealerToken) {
    dealerToken = await page.evaluate((tableCode) => {
      const key = `casino-lord:dealer-token:${tableCode}`;
      const raw = localStorage.getItem(key);
      if (!raw) return "";
      try {
        const parsed = JSON.parse(raw) as { token?: string };
        return typeof parsed.token === "string" ? parsed.token : raw;
      } catch {
        return raw;
      }
    }, code);
  }

  if (!code || !dealerToken) {
    throw new Error(
      `createTable: missing code or dealer token (code=${code}, token present=${Boolean(dealerToken)})`,
    );
  }

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

/** Volatile UI regions excluded from visual regression screenshots. */
export function screenshotMaskLocators(page: Page) {
  return [
    page.locator(".qr-badge"),
    page.locator('[data-testid="display-qr-badge"]'),
    page.locator('[data-testid="solo-play-qr"]'),
    page.locator('[data-testid="solo-display-qr"]'),
    page.locator('[data-testid="betting-countdown"]'),
    page.locator(".betting-strip__bar"),
    page.locator(".display-shell--idle-attract .display-shell__module"),
    page.locator(".display-shell__animation-overlay"),
    page.locator(".player-shell__animation-overlay"),
    page.locator('[data-testid="virtual-pending-ring"]'),
    page.locator('[data-testid="connection-dot"]'),
  ];
}

export async function prepareForScreenshot(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

export function screenshotOptions(page: Page) {
  return {
    animations: "disabled" as const,
    caret: "hide" as const,
    mask: screenshotMaskLocators(page),
  };
}
