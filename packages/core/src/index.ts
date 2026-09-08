/**
 * @casino-lord/core
 *
 * Platform primitives shared by every game module, the web client, and the
 * sync service. See SPEC.md for the full contract. This package must stay
 * pure: no network, no storage, no clock, no randomness except through an
 * injected `Rng`.
 */

export * from "./table-code.js";
export * from "./types.js";
