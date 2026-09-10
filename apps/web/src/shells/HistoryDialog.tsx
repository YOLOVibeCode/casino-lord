import { createElement, Fragment } from "preact";
import { useMemo, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import type { ResultEnvelope } from "@casino-lord/core";
import type { UntypedGameModule } from "../table/module-types.js";
import type { TableStore } from "../table/store.js";
import { buildResultList, type ResultListItem } from "../table/result-envelopes.js";
import { useConfirm } from "../ui/ConfirmSheet.js";
import "./history-dialog.css";

export interface HistoryDialogProps {
  store: TableStore;
  module: UntypedGameModule;
  rules: unknown;
  onClose: () => void;
  onEdit: (envelope: ResultEnvelope<unknown>) => void;
}

function resultSummary(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const r = data as Record<string, unknown>;
  if (typeof r.total === "number") {
    return r.hard === true ? `${r.total}H` : String(r.total);
  }
  if (r.cards === null) return "quick";
  const pt = r.playerTotal;
  const bt = r.bankerTotal;
  if (typeof pt === "number" && typeof bt === "number") return `${pt}–${bt}`;
  return "";
}

function resultBadges(data: unknown): string[] {
  if (typeof data !== "object" || data === null) return [];
  const r = data as Record<string, unknown>;
  const badges: string[] = [];
  if (r.playerPair) badges.push("P pair");
  if (r.bankerPair) badges.push("B pair");
  if (r.natural) badges.push("Natural");
  return badges;
}

function outcomeLetter(data: unknown): string {
  if (typeof data !== "object" || data === null) return "?";
  const outcome = (data as Record<string, unknown>).outcome;
  return typeof outcome === "string" ? outcome : "?";
}

export function HistoryDialog({ store, module, rules, onClose, onEdit }: HistoryDialogProps) {
  const { confirm } = useConfirm();
  const composed = store.getComposed();
  const moduleResults =
    (composed.module as { results?: { id: string; data: unknown }[] }).results ?? [];
  const items = useMemo(
    () => buildResultList(moduleResults, store.events),
    [moduleResults, store.events],
  );
  const newestFirst = useMemo(() => [...items].reverse(), [items]);

  const [selected, setSelected] = useState<ResultListItem | null>(null);

  const handleDelete = (): void => {
    if (!selected) return;
    void (async () => {
      const ok = await confirm({
        title: `Delete hand ${selected.index + 1}?`,
        body: "This removes the result and re-derives later settlements.",
        destructive: true,
        confirmLabel: "Hold to delete",
      });
      if (!ok) return;
      store.deleteResult(selected.id);
      setSelected(null);
      onClose();
    })();
  };

  const handleEdit = (): void => {
    if (!selected) return;
    const envelope: ResultEnvelope<unknown> = {
      id: selected.id,
      index: selected.index,
      recordedAt: selected.recordedAt,
      quick: selected.quick,
      source: "physical",
      by: "dealer",
      data: selected.data,
    };
    onEdit(envelope);
    onClose();
  };

  return (
    <div class="history-dialog__backdrop" data-testid="history-dialog" onClick={onClose}>
      <div class="history-dialog" onClick={(e) => e.stopPropagation()}>
        <header class="history-dialog__header">
          <span>History</span>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {!selected ? (
          <div class="history-dialog__list" data-testid="history-list">
            {newestFirst.length === 0 && (
              <p style={{ padding: "1rem", color: "#aaa" }}>No results yet.</p>
            )}
            {newestFirst.map((item) => {
              const letter = outcomeLetter(item.data);
              const summary = resultSummary(item.data);
              const badges = resultBadges(item.data);
              return (
                <button
                  key={item.id}
                  type="button"
                  class="history-dialog__row"
                  data-testid={`history-row-${item.index}`}
                  onClick={() => setSelected(item)}
                >
                  <span class="history-dialog__index">{item.index + 1}</span>
                  <span class={`history-dialog__outcome history-dialog__outcome--${letter}`}>
                    {letter}
                  </span>
                  <span>{summary}</span>
                  {badges.length > 0 && (
                    <span class="history-dialog__badges">
                      {badges.map((b) => (
                        <span key={b} class="history-dialog__badge">
                          {b}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div class="history-dialog__detail" data-testid="history-detail">
            <button type="button" onClick={() => setSelected(null)}>
              ← Back
            </button>
            {createElement(
              module.ResultDetailView as unknown as ComponentType<{
                result: unknown;
                rules: unknown;
                roll?: unknown;
              }>,
              {
                result: selected.data,
                rules,
                ...(store.game === "craps"
                  ? {
                      roll: (
                        composed.module as {
                          results?: { id: string }[];
                        }
                      ).results?.find((r) => r.id === selected.id),
                    }
                  : {}),
              },
            )}
            <div class="history-dialog__actions">
              <button type="button" data-testid="history-edit-btn" onClick={handleEdit}>
                Edit
              </button>
              <button type="button" data-testid="history-delete-btn" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
