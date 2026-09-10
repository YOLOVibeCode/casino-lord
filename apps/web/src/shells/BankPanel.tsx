import { getBankroll, getChipsInPlay } from "@casino-lord/core";
import type { ComposedState, TableSettings } from "@casino-lord/core";
import { useCallback, useRef, useState } from "preact/hooks";
import type { TableStore } from "../table/store.js";
import "./bank-panel.css";

export interface BankPanelProps {
  store: TableStore;
  composed: ComposedState<unknown>;
  settings: TableSettings;
  onClose: () => void;
}

type IssueReason = "buyin" | "rebuy" | "bonus" | "correction";

export function BankPanel({ store, composed, settings, onClose }: BankPanelProps) {
  const [selectedPlayer, setSelectedPlayer] = useState(composed.platform.players[0]?.id ?? "");
  const [issueAmount, setIssueAmount] = useState(String(settings.bank.defaultBuyIn));
  const [adjustAmount, setAdjustAmount] = useState("");
  const [takeBackAmount, setTakeBackAmount] = useState("");
  const [issueReason, setIssueReason] = useState<IssueReason>("buyin");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chips = getChipsInPlay(composed.platform);
  const activePlayers = composed.platform.players.filter((p) => p.status !== "removed");
  const selectedName = activePlayers.find((p) => p.id === selectedPlayer)?.name ?? "player";

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 4000);
  }, []);

  const issueChips = (
    playerId: string,
    amount: number,
    reason: IssueReason,
    playerName?: string,
  ) => {
    if (amount <= 0) return;
    store.emit({ type: "BANK_ISSUED", playerId, amount, reason });
    const name = playerName ?? activePlayers.find((p) => p.id === playerId)?.name ?? "player";
    showToast(`Issued ${amount.toLocaleString()} to ${name}`);
  };

  const adjustChips = (playerId: string, delta: number) => {
    if (delta === 0) return;
    const bankroll = getBankroll(composed.platform, playerId);
    if (delta < 0 && -delta > bankroll) return;
    store.emit({
      type: "BANK_ADJUSTED",
      playerId,
      delta,
      reason: "correction",
    });
    showToast(`Adjusted ${selectedName} by ${delta > 0 ? "+" : ""}${delta.toLocaleString()}`);
  };

  const takeBackChips = (playerId: string, amount: number) => {
    if (amount <= 0) return;
    const bankroll = getBankroll(composed.platform, playerId);
    if (amount > bankroll) return;
    store.emit({
      type: "BANK_ADJUSTED",
      playerId,
      delta: -amount,
      reason: "takeback",
    });
    showToast(`Took back ${amount.toLocaleString()} from ${selectedName}`);
  };

  const patchBank = (patch: Partial<TableSettings["bank"]>) => {
    store.emit({ type: "SETTINGS_CHANGED", patch: { bank: patch } });
  };

  return (
    <div class="bank-panel__backdrop" data-testid="bank-panel" onClick={onClose}>
      <div class="bank-panel" onClick={(e) => e.stopPropagation()}>
        <header class="bank-panel__header">
          <h2>Bank</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <section class="bank-panel__section">
          <h3>Chips in play</h3>
          <div class="bank-panel__summary" data-testid="chips-summary">
            <span>Issued: {chips.issued.toLocaleString()}</span>
            <span>In bankrolls: {chips.inBankrolls.toLocaleString()}</span>
            <span>On felt: {chips.onFelt.toLocaleString()}</span>
          </div>
        </section>

        {activePlayers.length === 0 ? (
          <p class="bank-panel__empty" data-testid="bank-empty">
            No players yet — share the Join QR
          </p>
        ) : (
          <>
            <section class="bank-panel__section">
              <h3>Issue chips</h3>
              <label>Default buy-in: {settings.bank.defaultBuyIn}</label>
              <label>
                Player
                <select
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer((e.target as HTMLSelectElement).value)}
                >
                  {activePlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reason
                <select
                  data-testid="issue-reason"
                  value={issueReason}
                  onChange={(e) =>
                    setIssueReason((e.target as HTMLSelectElement).value as IssueReason)
                  }
                >
                  <option value="buyin">Buy-in</option>
                  <option value="rebuy">Rebuy</option>
                  <option value="bonus">Bonus</option>
                  <option value="correction">Correction</option>
                </select>
              </label>
              <label>
                Amount
                <input
                  type="number"
                  min={1}
                  value={issueAmount}
                  onInput={(e) => setIssueAmount((e.target as HTMLInputElement).value)}
                />
              </label>
              <div class="bank-panel__actions">
                <button
                  type="button"
                  data-testid="issue-one"
                  onClick={() =>
                    issueChips(selectedPlayer, Number(issueAmount), issueReason, selectedName)
                  }
                >
                  Issue to player
                </button>
                <button
                  type="button"
                  data-testid="issue-all"
                  onClick={() => {
                    const amount = Number(issueAmount);
                    for (const p of activePlayers) {
                      issueChips(p.id, amount, issueReason, p.name);
                    }
                  }}
                >
                  Issue to all
                </button>
              </div>
            </section>

            <section class="bank-panel__section">
              <h3>Take back</h3>
              <label>
                Amount
                <input
                  type="number"
                  min={1}
                  data-testid="take-back-amount"
                  value={takeBackAmount}
                  onInput={(e) => setTakeBackAmount((e.target as HTMLInputElement).value)}
                />
              </label>
              <button
                type="button"
                data-testid="take-back"
                onClick={() => takeBackChips(selectedPlayer, Number(takeBackAmount))}
              >
                Take back
              </button>
            </section>

            <section class="bank-panel__section">
              <h3>Adjust</h3>
              <label>
                Adjustment amount
                <input
                  type="number"
                  data-testid="adjust-amount"
                  value={adjustAmount}
                  onInput={(e) => setAdjustAmount((e.target as HTMLInputElement).value)}
                />
              </label>
              <button
                type="button"
                data-testid="adjust-chips"
                onClick={() => adjustChips(selectedPlayer, Number(adjustAmount))}
              >
                Adjust
              </button>
            </section>
          </>
        )}

        <section class="bank-panel__section">
          <h3>Table limits</h3>
          <label>
            Table min
            <input
              type="number"
              min={1}
              value={settings.bank.tableMin}
              onChange={(e) =>
                patchBank({ tableMin: Number((e.target as HTMLInputElement).value) })
              }
            />
          </label>
          <label>
            Table max
            <input
              type="number"
              min={1}
              value={settings.bank.tableMax}
              onChange={(e) =>
                patchBank({ tableMax: Number((e.target as HTMLInputElement).value) })
              }
            />
          </label>
          <label>
            Max exposure (0 = off)
            <input
              type="number"
              min={0}
              value={settings.bank.maxExposure}
              onChange={(e) =>
                patchBank({ maxExposure: Number((e.target as HTMLInputElement).value) })
              }
            />
          </label>
        </section>

        {toastMsg && (
          <div class="bank-panel__toast" data-testid="bank-toast" role="alert">
            {toastMsg}
          </div>
        )}
      </div>
    </div>
  );
}
