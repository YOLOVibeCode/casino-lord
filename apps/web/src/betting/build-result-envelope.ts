import { getClosedRound, type ComposedState, type ResultEnvelope } from "@casino-lord/core";

export function buildResultEnvelope(
  composed: ComposedState<unknown>,
  result: unknown,
  opts: { quick: boolean; id: string; now: string },
): ResultEnvelope<unknown> {
  const closedRound = getClosedRound(composed.platform);
  return {
    id: opts.id,
    index: Array.isArray((composed.module as { results?: unknown[] }).results)
      ? (composed.module as { results: unknown[] }).results.length
      : 0,
    recordedAt: opts.now,
    quick: opts.quick,
    source: "physical",
    by: "dealer",
    data: result,
    ...(closedRound ? { roundId: closedRound.id } : {}),
  };
}
