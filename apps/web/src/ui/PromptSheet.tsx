import { createContext } from "preact";
import { useCallback, useContext, useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import "./sheet.css";

export interface PromptOptions {
  title?: string;
  label: string;
  multiline?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
  validate?: (value: string) => string | null;
  preview?: (value: string) => string | null;
  pasteFromClipboard?: boolean;
}

interface PendingPrompt extends PromptOptions {
  resolve: (value: string | null) => void;
}

interface PromptContextValue {
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const PromptContext = createContext<PromptContextValue | null>(null);

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function PromptSheetView({
  request,
  onResolve,
}: {
  request: PendingPrompt;
  onResolve: (value: string | null) => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(request.defaultValue ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const previewText = request.preview?.(value) ?? null;

  const confirmLabel = request.confirmLabel ?? "OK";
  const cancelLabel = request.cancelLabel ?? "Cancel";

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const focusables = sheet.querySelectorAll<HTMLElement>(FOCUSABLE);
    const input = sheet.querySelector<HTMLElement>("textarea, input");
    (input ?? focusables[0])?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onResolve(null);
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

  const handleConfirm = () => {
    const err = request.validate?.(value) ?? null;
    if (err) {
      setValidationError(err);
      return;
    }
    onResolve(value);
  };

  const handlePaste = async () => {
    if (!navigator.clipboard?.readText) return;
    try {
      const text = await navigator.clipboard.readText();
      setValue(text);
      setValidationError(null);
    } catch {
      setValidationError("Could not read clipboard");
    }
  };

  return (
    <div
      class="ui-sheet-backdrop"
      data-testid="prompt-sheet-backdrop"
      onClick={() => onResolve(null)}
    >
      <div
        ref={sheetRef}
        class="ui-sheet"
        data-testid="prompt-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        {request.title && (
          <header class="ui-sheet__header">
            <span id="prompt-sheet-title">{request.title}</span>
          </header>
        )}
        <div class="ui-sheet__field">
          <label for="prompt-sheet-input">{request.label}</label>
          {request.multiline ? (
            <textarea
              id="prompt-sheet-input"
              class="ui-sheet__textarea"
              data-testid="prompt-sheet-input"
              value={value}
              onInput={(e) => {
                setValue((e.target as HTMLTextAreaElement).value);
                setValidationError(null);
              }}
            />
          ) : (
            <input
              id="prompt-sheet-input"
              type="text"
              class="ui-sheet__input"
              data-testid="prompt-sheet-input"
              value={value}
              onInput={(e) => {
                setValue((e.target as HTMLInputElement).value);
                setValidationError(null);
              }}
            />
          )}
        </div>
        {request.pasteFromClipboard && typeof navigator.clipboard?.readText === "function" && (
          <div class="ui-sheet__secondary">
            <button
              type="button"
              class="ui-sheet__secondary-btn"
              data-testid="prompt-sheet-paste"
              onClick={() => void handlePaste()}
            >
              Paste from clipboard
            </button>
          </div>
        )}
        {previewText && (
          <div class="ui-sheet__preview" data-testid="prompt-sheet-preview">
            {previewText}
          </div>
        )}
        {validationError && (
          <div class="ui-sheet__error" data-testid="prompt-sheet-error">
            {validationError}
          </div>
        )}
        <div class="ui-sheet__actions">
          <button
            type="button"
            class="ui-sheet__btn ui-sheet__btn--cancel"
            data-testid="prompt-sheet-cancel"
            onClick={() => onResolve(null)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            class="ui-sheet__btn ui-sheet__btn--primary"
            data-testid="prompt-sheet-confirm"
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PromptProvider({ children }: { children: ComponentChildren }) {
  const [pending, setPending] = useState<PendingPrompt | null>(null);
  const pendingRef = useRef<PendingPrompt | null>(null);

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      const req: PendingPrompt = { ...options, resolve };
      pendingRef.current = req;
      setPending(req);
    });
  }, []);

  const resolve = useCallback((value: string | null) => {
    const req = pendingRef.current;
    if (!req) return;
    pendingRef.current = null;
    setPending(null);
    req.resolve(value);
  }, []);

  return (
    <PromptContext.Provider value={{ prompt }}>
      {children}
      {pending && <PromptSheetView request={pending} onResolve={resolve} />}
    </PromptContext.Provider>
  );
}

export function usePrompt(): PromptContextValue {
  const ctx = useContext(PromptContext);
  if (!ctx) {
    throw new Error("usePrompt must be used within PromptProvider");
  }
  return ctx;
}
