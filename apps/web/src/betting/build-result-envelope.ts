import {
  getClosedRound,
  getCurrentSeriesResults,
  type ComposedState,
  type ResultEnvelope,
} from "@casino-lord/core";

export function buildResultEnvelope(
  composed: ComposedState<unknown>,
  result: unknown,
  opts: { quick: boolean; id: string; now: string },
): ResultEnvelope<unknown> {
  const closedRound = getClosedRound(composed.platform);
  return {
    id: opts.id,
    index: getCurrentSeriesResults(composed.platform).length,
    recordedAt: opts.now,
    quick: opts.quick,
    source: "physical",
    by: "dealer",
    data: result,
    ...(closedRound ? { roundId: closedRound.id } : {}),
  };
}
