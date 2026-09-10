import { useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";

export interface UseDialogA11yOptions {
  panelRef: RefObject<HTMLElement>;
  onClose: () => void;
  titleId: string;
}

export interface DialogA11yProps {
  role: "dialog";
  "aria-modal": "true";
  "aria-labelledby": string;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogA11y({
  panelRef,
  onClose,
  titleId,
}: UseDialogA11yOptions): { dialogProps: DialogA11yProps } {
  const previousFocus = useRef<Element | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    const panel = panelRef.current;
    if (panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const prev = previousFocus.current;
      if (prev instanceof HTMLElement && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [panelRef, onClose]);

  return {
    dialogProps: {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
    },
  };
}
