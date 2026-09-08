/**
 * @casino-lord/core
 *
 * Platform primitives shared by every game module, the web client, and the
 * sync service. See SPEC.md for the full contract. This package must stay
 * pure: no network, no storage, no clock, no randomness except through an
 * injected `Rng`.
 */

export * from "./animation.js";
export * from "./betting.js";
export * from "./data-model.js";
export * from "./events.js";
export * from "./game-module.js";
export * from "./platform-reducer.js";
export * from "./platform-state.js";
export * from "./platform-types.js";
export * from "./replay.js";
export * from "./settings.js";
export * from "./table-code.js";
export * from "./types.js";
