export function minimalBaccaratResult() {
  return {
    cards: null,
    outcome: "P" as const,
    playerTotal: 8,
    bankerTotal: 6,
    playerPair: false,
    bankerPair: false,
    natural: true,
  };
}

export function resultRecordedEvent(index: number, id: string) {
  return {
    type: "RESULT_RECORDED" as const,
    result: {
      id,
      index: index - 1,
      recordedAt: `2026-01-01T00:00:${String(index).padStart(2, "0")}.000Z`,
      quick: false,
      source: "physical" as const,
      by: "dealer" as const,
      data: minimalBaccaratResult(),
    },
  };
}
