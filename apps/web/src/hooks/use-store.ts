import { useEffect, useState } from "preact/hooks";
import type { TableStore } from "../table/store.js";

export function useStore(store: TableStore): TableStore {
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick((n) => n + 1)), [store]);
  return store;
}
