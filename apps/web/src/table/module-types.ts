import type { GameModule } from "@casino-lord/core";

export type UntypedGameModule = GameModule<unknown, unknown, unknown, unknown, unknown, never>;

export function asUntypedModule(module: unknown): UntypedGameModule {
  return module as UntypedGameModule;
}
