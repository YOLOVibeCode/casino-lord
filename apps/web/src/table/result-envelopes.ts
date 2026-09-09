import type { ResultEnvelope, TableEvent } from "@casino-lord/core";

export interface ResultListItem<R = unknown> {
  id: string;
  index: number;
  quick: boolean;
  recordedAt: string;
  data: R;
}

export function buildResultList<R>(
  results: { id: string; data: R }[],
  events: readonly TableEvent[],
): ResultListItem<R>[] {
  const envelopeById = new Map<string, ResultEnvelope<R>>();

  for (const event of events) {
    if (event.type === "RESULT_RECORDED" || event.type === "RESULT_EDITED") {
      envelopeById.set(event.result.id, event.result as ResultEnvelope<R>);
    }
  }

  return results.map((entry, arrayIndex) => {
    const envelope = envelopeById.get(entry.id);
    return {
      id: entry.id,
      index: envelope?.index ?? arrayIndex,
      quick: envelope?.quick ?? false,
      recordedAt: envelope?.recordedAt ?? "",
      data: entry.data,
    };
  });
}

export function findResultEnvelope<R>(
  resultId: string,
  events: readonly TableEvent[],
): ResultEnvelope<R> | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;
    if (
      (event.type === "RESULT_RECORDED" || event.type === "RESULT_EDITED") &&
      event.result.id === resultId
    ) {
      return event.result as ResultEnvelope<R>;
    }
  }
  return null;
}
