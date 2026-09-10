import { createContext } from "preact";
import { useCallback, useContext, useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import "./toast.css";

export type ToastKind = "info" | "success" | "error";

export interface ToastOptions {
  testId?: string;
  durationMs?: number;
}

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  testId?: string;
  durationMs: number;
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 4000;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [active, setActive] = useState<ToastItem | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setActive(null);
  }, []);

  useEffect(() => {
    if (active || queue.length === 0) return;
    const next = queue[0]!;
    setQueue((q) => q.slice(1));
    setActive(next);
  }, [active, queue]);

  useEffect(() => {
    if (!active) return;
    const duration = prefersReducedMotion() ? Math.min(active.durationMs, 2000) : active.durationMs;
    timerRef.current = setTimeout(dismiss, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, dismiss]);

  const show = useCallback((message: string, kind: ToastKind = "error", options?: ToastOptions) => {
    const item: ToastItem = {
      id: ++idRef.current,
      message,
      kind,
      ...(options?.testId !== undefined ? { testId: options.testId } : {}),
      durationMs: options?.durationMs ?? DEFAULT_DURATION_MS,
    };
    setQueue((q) => [...q, item]);
  }, []);

  const value: ToastContextValue = {
    show,
    info: (message, options) => show(message, "info", options),
    success: (message, options) => show(message, "success", options),
    error: (message, options) => show(message, "error", options),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div class="ui-toast-host" aria-live="polite" aria-atomic="true">
        {active && (
          <div
            class={`ui-toast ui-toast--${active.kind}`}
            {...(active.testId ? { "data-testid": active.testId } : {})}
            role="alert"
          >
            <span>{active.message}</span>
            <button type="button" class="ui-toast-dismiss" aria-label="Dismiss" onClick={dismiss}>
              ✕
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
