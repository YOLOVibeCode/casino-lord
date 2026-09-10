import { useMemo, useRef, useState } from "preact/hooks";
import { useDialogA11y } from "./use-dialog-a11y.js";
import type { UntypedGameModule } from "../table/module-types.js";
import type { TableStore } from "../table/store.js";
import { computeAllBetRows } from "../calculator/payout-calculator.js";
import "./calculator-dialog.css";

export interface CalculatorDialogProps {
  store: TableStore;
  module: UntypedGameModule;
  rules: unknown;
  onClose: () => void;
}

export function CalculatorDialog({ store, module, rules, onClose }: CalculatorDialogProps) {
  const [amountStr, setAmountStr] = useState("100");
  const panelRef = useRef<HTMLDivElement>(null);
  const { dialogProps } = useDialogA11y({
    panelRef,
    onClose,
    titleId: "calculator-dialog-title",
  });
  const composed = store.getComposed();
  const amount = Number(amountStr) || 0;
  const roundingMode = composed.platform.settings.bank.roundingMode;
  const currency = composed.platform.settings.currency;

  const rows = useMemo(
    () => computeAllBetRows(module.bets.groups, amount, rules, roundingMode),
    [module.bets.groups, amount, rules, roundingMode],
  );

  const prefix = currency ? `${currency} ` : "";

  const pressKey = (key: string): void => {
    if (key === "clear") {
      setAmountStr("");
      return;
    }
    if (key === "back") {
      setAmountStr((s) => s.slice(0, -1));
      return;
    }
    setAmountStr((s) => `${s}${key}`);
  };

  return (
    <div class="calculator-dialog__backdrop" data-testid="calculator-dialog" onClick={onClose}>
      <div
        ref={panelRef}
        class="calculator-dialog"
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
      >
        <header class="calculator-dialog__header">
          <span id="calculator-dialog-title">Payout Calculator</span>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div class="calculator-dialog__amount" data-testid="calculator-amount">
          {prefix}
          {amountStr || "0"}
        </div>
        <div class="calculator-dialog__keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((key) => (
            <button
              key={key}
              type="button"
              class="calculator-dialog__key"
              onClick={() => pressKey(key === "clear" ? "clear" : key === "back" ? "back" : key)}
            >
              {key === "clear" ? "C" : key === "back" ? "⌫" : key}
            </button>
          ))}
        </div>
        <div class="calculator-dialog__rows">
          {module.bets.groups.map((group) => (
            <section key={group.id}>
              <div class="calculator-dialog__group-label">{group.label}</div>
              {rows
                .filter((row) => group.bets.some((b) => b.id === row.id))
                .map((row) => (
                  <div
                    key={row.id}
                    class="calculator-dialog__row"
                    data-testid={`calculator-row-${row.id}`}
                  >
                    <div>
                      <div class="calculator-dialog__bet-label">{row.label}</div>
                      <div class="calculator-dialog__bet-meta">
                        {row.pays}
                        {row.note ? ` · ${row.note}` : ""}
                      </div>
                    </div>
                    <div class="calculator-dialog__returns">
                      <div>+{row.profit}</div>
                      <div class="calculator-dialog__bet-meta">ret {row.returned}</div>
                    </div>
                  </div>
                ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
