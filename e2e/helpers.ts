import { expect, type Browser, type Page } from "@playwright/test";

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

async function readDealerToken(page: Page, code: string): Promise<string> {
  const fromStorage = await page.evaluate((tableCode) => {
    // keep in sync with apps/web/src/sync/dealer-token.ts loadDealerToken
    const PREFIX = "casino-lord:dealer-token:";
    const raw = localStorage.getItem(`${PREFIX}${tableCode}`);
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw) as { token?: string };
      return typeof parsed.token === "string" ? parsed.token : raw;
    } catch {
      return raw;
    }
  }, code);
  if (fromStorage) return fromStorage;
  return new URL(page.url()).searchParams.get("t") ?? "";
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
  const created = page.getByTestId("table-created-page");
  const createError = page.getByText("Could not create table");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await created.waitFor({ timeout: 8_000 });
      break;
    } catch (err) {
      if (!(await createError.isVisible().catch(() => false)) || attempt === 4) {
        throw err;
      }
      await page.waitForTimeout(15_000);
      await page.getByRole("button", { name: "Create", exact: true }).click();
    }
  }

  const url = new URL(page.url());
  const code = url.pathname.split("/").pop() ?? "";

  let dealerToken = "";
  await expect
    .poll(
      async () => {
        dealerToken = await readDealerToken(page, code);
        return dealerToken;
      },
      { timeout: 10_000 },
    )
    .not.toBe("");

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
    await pending.waitFor({ state: "hidden", timeout: 20_000 });
  }
  await page.waitForTimeout(200);
}

export async function waitForBankroll(player: Page, amount: number): Promise<void> {
  await expect
    .poll(async () => parseBankroll(await player.getByTestId("player-bankroll").textContent()), {
      timeout: 10_000,
    })
    .toBe(amount);
}

export async function waitForVirtualResult(dealer: Page, previousText?: string): Promise<void> {
  const last = dealer.getByTestId("virtual-last-result");
  await expect(last).toBeVisible({ timeout: 25_000 });
  if (previousText !== undefined) {
    await expect
      .poll(async () => (await last.textContent()) ?? "", { timeout: 15_000 })
      .not.toBe(previousText);
  }
}

/** Wait out the current reveal overlay, then the next last-result (dice totals can repeat). */
export async function waitForNextVirtualResult(dealer: Page): Promise<void> {
  const last = dealer.getByTestId("virtual-last-result");
  const reveal = dealer.getByTestId("virtual-reveal");
  if (await last.isVisible().catch(() => false)) {
    await Promise.race([
      last.waitFor({ state: "hidden", timeout: 15_000 }),
      reveal.waitFor({ state: "visible", timeout: 15_000 }),
    ]).catch(() => undefined);
  }
  await expect(last).toBeVisible({ timeout: 25_000 });
}

export async function joinAsPlayer(
  page: Page,
  code: string,
  name: string,
  color: string,
): Promise<void> {
  await page.goto(`/play/${code}`);
  await page.getByTestId("player-name-input").fill(name);
  await page.getByTestId(`color-${color}`).click();
  await page.getByTestId("join-btn").click();
}

export async function admitIfPending(player: Page, dealer: Page): Promise<void> {
  if (
    await player
      .getByTestId("pending-message")
      .isVisible()
      .catch(() => false)
  ) {
    await dealer.getByTestId("players-btn").click();
    await dealer.getByTestId("players-dialog").waitFor();
    const approve = dealer.locator('[data-testid^="approve-"]');
    const count = await approve.count();
    for (let i = 0; i < count; i += 1) {
      await approve.nth(i).click();
    }
    await dealer.getByTestId("players-dialog").locator('button[aria-label="Close"]').click();
  }
  await player.getByTestId("player-shell").waitFor({ timeout: 10_000 });
}

export async function issueChipsToAll(dealer: Page): Promise<void> {
  await dealer.getByTestId("bank-btn").click();
  await dealer.getByTestId("bank-panel").waitFor();
  await dealer.getByTestId("issue-all").click();
  await dealer.getByTestId("bank-panel").locator('button[aria-label="Close"]').click();
}

export async function placeFeltBet(player: Page, zoneTestId: string, denom = 100): Promise<void> {
  await player.getByTestId(`chip-denom-${denom}`).click();
  await player.getByTestId(zoneTestId).click();
  await player.getByTestId("bet-slip-place").click();
}

export async function expectDisplaySettlement(
  display: Page,
  playerName: string,
  kind: "any" | "win" | "lose" | "nonzero" = "any",
  player?: Page,
  timeout = 25_000,
): Promise<void> {
  const pattern =
    kind === "win"
      ? new RegExp(`${playerName} \\+[1-9]|\\+[1-9]\\d*`)
      : kind === "lose"
        ? new RegExp(`${playerName} -|-\\d`)
        : kind === "nonzero"
          ? new RegExp(`${playerName} (?:\\+[1-9]|-)|\\+[1-9]|-\\d`)
          : new RegExp(`${playerName} [+-]|[+-]\\d`);
  await expect
    .poll(
      async () => {
        const strip =
          (await display
            .getByTestId("betting-strip")
            .locator(".betting-strip__status")
            .textContent()) ?? "";
        const bar = player
          ? ((await player.getByTestId("player-status-bar").textContent()) ?? "")
          : "";
        return `${strip} | ${bar}`;
      },
      { timeout },
    )
    .toMatch(pattern);
}

export interface SyncedSession {
  code: string;
  dealer: Page;
  display: Page;
  players: Page[];
}

export async function setupSyncedTable(
  browser: Browser,
  options: CreateTableOptions & { players: Array<{ name: string; color: string }> },
): Promise<SyncedSession> {
  const landing = await browser.newPage();
  const { code, dealerToken } = await createTable(landing, options);
  await landing.close();

  const dealer = await browser.newPage();
  await dealer.goto(`/dealer/${code}?t=${encodeURIComponent(dealerToken)}`);
  await dealer.getByTestId("dealer-shell").waitFor();

  const players: Page[] = [];
  for (const p of options.players) {
    const page = await browser.newPage();
    await joinAsPlayer(page, code, p.name, p.color);
    players.push(page);
  }

  for (const page of players) {
    await admitIfPending(page, dealer);
  }

  if (options.houseBank) {
    await issueChipsToAll(dealer);
    for (const page of players) {
      await waitForBankroll(page, 500);
    }
  }

  const display = await browser.newPage();
  await display.goto(`/display/${code}`);
  await display.getByTestId("display-shell").waitFor();

  return { code, dealer, display, players };
}

export async function closeSyncedSession(session: SyncedSession): Promise<void> {
  await session.dealer.close();
  await session.display.close();
  await Promise.all(session.players.map((page) => page.close()));
}

export async function recordRoulettePocket(dealer: Page, pocket: string): Promise<void> {
  await dealer.getByTestId(`number-cell-${pocket}`).click();
  const confirm = dealer.getByTestId("confirm-btn");
  await expect(confirm).toBeEnabled({ timeout: 10_000 });
  await confirm.click();
}

export async function recordCrapsTotal(dealer: Page, total: number): Promise<void> {
  if (
    !(await dealer
      .getByTestId("total-mode")
      .isVisible()
      .catch(() => false))
  ) {
    await dealer.getByTestId("total-mode-toggle").click();
  }
  await dealer.getByTestId(`outcome-chip-t${total}`).click();
}

export async function recordBlackjackQuick(dealer: Page, chipId: string): Promise<void> {
  await dealer.getByTestId(`outcome-chip-${chipId}`).click();
}

/** Sync virtual trigger limit is 2 / 1000ms (apps/sync rate-limit). */
const VIRTUAL_TRIGGER_GAP_MS = 650;

export async function triggerVirtualDeal(dealer: Page): Promise<void> {
  const deal = dealer.getByTestId("deal-btn");
  await expect(deal).toBeEnabled({ timeout: 10_000 });
  await deal.click();
  await dealer.waitForTimeout(VIRTUAL_TRIGGER_GAP_MS);
}

export async function completeVirtualBlackjackHand(dealer: Page, player: Page): Promise<void> {
  let stood = false;
  for (let i = 0; i < 32; i += 1) {
    if (
      await dealer
        .getByTestId("virtual-last-result")
        .isVisible()
        .catch(() => false)
    ) {
      return;
    }

    const stand = player.getByTestId("action-btn-stand");
    if (
      !stood &&
      (await stand.isVisible().catch(() => false)) &&
      (await stand.isEnabled().catch(() => false))
    ) {
      stood = true;
      await stand.click();
      await player.waitForTimeout(VIRTUAL_TRIGGER_GAP_MS);
      continue;
    }

    const deal = dealer.getByTestId("deal-btn");
    if (await deal.isEnabled().catch(() => false)) {
      await deal.click();
      await dealer.waitForTimeout(1_200);
      continue;
    }

    const force = dealer.getByTestId("force-btn");
    if (
      (await force.isVisible().catch(() => false)) &&
      (await force.isEnabled().catch(() => false))
    ) {
      await force.click();
      await dealer.waitForTimeout(VIRTUAL_TRIGGER_GAP_MS);
      continue;
    }

    await dealer.waitForTimeout(400);
  }
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
    await bar.getByTestId("betting-toggle-btn").click();
    await status.filter({ hasText: "BETS OPEN" }).waitFor({ timeout: 5_000 });
  }
}

export async function closeBetsIfOpen(dealerPage: Page): Promise<void> {
  const bar = dealerPage.getByTestId("betting-bar");
  const status = bar.locator(".betting-bar__status");
  const text = (await status.textContent()) ?? "";
  if (text.includes("BETS OPEN")) {
    await bar.getByTestId("betting-toggle-btn").click();
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
    page.locator(".player-shell__animation-overlay:not(:empty)"),
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
