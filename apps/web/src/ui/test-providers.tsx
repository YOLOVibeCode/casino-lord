import { render } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import { ConfirmProvider } from "./ConfirmSheet.js";
import { PromptProvider } from "./PromptSheet.js";
import { ToastProvider } from "./Toast.js";

export function UiProviders({ children }: { children: ComponentChildren }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <PromptProvider>{children}</PromptProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export function renderWithUiProviders(ui: ComponentChildren): ReturnType<typeof render> {
  return render(<UiProviders>{ui}</UiProviders>);
}
