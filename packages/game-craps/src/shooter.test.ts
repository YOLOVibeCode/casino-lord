import { describe, expect, it } from "vitest";
import { assignShooter, nextShooterInOrder, passDice } from "./shooter.js";
import { initialState } from "./state.js";
import { reduce } from "./reducer.js";
import { DEFAULT_CRAPS_RULES } from "./rules.js";

describe("shooter rotation bookkeeping", () => {
  it("rotates in join order skipping absent", () => {
    expect(nextShooterInOrder(["a", "b", "c"], "a", ["b"])).toBe("c");
    expect(nextShooterInOrder(["a", "b", "c"], "c", ["b"])).toBe("a");
  });

  it("pass dice on come-out advances shooter", () => {
    let state = initialState();
    state = {
      ...state,
      phase: "come_out",
      shooterOrder: ["p1", "p2", "p3"],
      currentShooterId: "p1",
    };
    state = passDice(state);
    expect(state.currentShooterId).toBe("p2");
  });

  it("dealer assign via TURN_ASSIGNED", () => {
    let state = assignShooter(initialState(), "dealer-pick");
    expect(state.currentShooterId).toBe("dealer-pick");
  });

  it("PLAYER_JOINED appends to order", () => {
    let state = reduce(
      initialState(),
      {
        seq: 1,
        at: "",
        type: "PLAYER_JOINED",
        player: { id: "p1", name: "A", color: "#fff", joinedAt: "", status: "active" },
      },
      DEFAULT_CRAPS_RULES,
    );
    expect(state.shooterOrder).toEqual(["p1"]);
    expect(state.currentShooterId).toBe("p1");
  });
});
