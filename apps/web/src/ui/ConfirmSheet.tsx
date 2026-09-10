import { createContext } from "preact";
import { useCallback, useContext, useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import "./sheet.css";

const HOLD_MS = 600;

export interface ConfirmOptions {
  title: string;
  body?: string;
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ConfirmSheetView({
  request,
  onResolve,
}: {
  request: PendingConfirm;
  onResolve: (value: boolean) => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStarted = useRef(0);

  const clearHold = useCallback(() => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
    setHoldProgress(0);
  }, []);

  const confirmLabel =
    request.confirmLabel ?? (request.destructive ? "Hold to confirm" : "Confirm");
  const cancelLabel = request.cancelLabel ?? "Cancel";

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const focusables = sheet.querySelectorAll<HTMLElement>(FOCUSABLE);
    focusables[0]?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onResolve(false);
        return;
      }
      if (e.key !== "Tab" || focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", trap);
    return () => window.removeEventListener("keydown", trap);
  }, [onResolve]);

  useEffect(() => () => clearHold(), [clearHold]);

  const startHold = () => {
    if (!request.destructive) return;
    setHolding(true);
    holdStarted.current = Date.now();
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - holdStarted.current;
      const p = Math.min(1, elapsed / HOLD_MS);
      setHoldProgress(p);
      if (p >= 1) {
        clearHold();
        onResolve(true);
      }
    }, 50);
  };

  const handleConfirmClick = () => {
    if (request.destructive) return;
    onResolve(true);
  };

  return (
    <div
      class="ui-sheet-backdrop"
      data-testid="confirm-sheet-backdrop"
      onClick={() => onResolve(false)}
    >
      <div
        ref={sheetRef}
        class="ui-sheet"
        data-testid="confirm-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header class="ui-sheet__header">
          <span id="confirm-sheet-title">{request.title}</span>
        </header>
        {request.body && <div class="ui-sheet__body">{request.body}</div>}
        <div class="ui-sheet__actions">
          <button
            type="button"
            class="ui-sheet__btn ui-sheet__btn--cancel"
            data-testid="confirm-sheet-cancel"
            onClick={() => onResolve(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            class={`ui-sheet__btn ui-sheet__btn--primary${request.destructive ? " ui-sheet__btn--destructive" : ""}`}
            data-testid="confirm-sheet-confirm"
            onClick={handleConfirmClick}
            onPointerDown={startHold}
            onPointerUp={clearHold}
            onPointerLeave={clearHold}
            onPointerCancel={clearHold}
          >
            {holding && request.destructive && (
              <span
                class="ui-sheet__hold-progress"
                style={{ transform: `scaleX(${holdProgress})` }}
              />
            )}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmProvider({ children }: { children: ComponentChildren }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      const req: PendingConfirm = { ...options, resolve };
      pendingRef.current = req;
      setPending(req);
    });
  }, []);

  const resolve = useCallback((value: boolean) => {
    const req = pendingRef.current;
    if (!req) return;
    pendingRef.current = null;
    setPending(null);
    req.resolve(value);
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && <ConfirmSheetView request={pending} onResolve={resolve} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx;
}
