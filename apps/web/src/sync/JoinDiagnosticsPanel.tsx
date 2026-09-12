import { useState } from "preact/hooks";
import { formatJoinDiagnostics, type JoinDiagnosticReport } from "./join-diagnostics.js";

export function JoinDiagnosticsPanel({
  report,
  defaultOpen = true,
}: {
  report: JoinDiagnosticReport;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const text = formatJoinDiagnostics(report);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section class="join-diag" data-testid="join-diagnostics">
      <button
        type="button"
        class="join-diag__toggle"
        data-testid="join-diagnostics-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Join diagnostics {open ? "▾" : "▸"}
      </button>
      {open && (
        <div class="join-diag__body">
          <pre class="join-diag__pre" data-testid="join-diagnostics-text">
            {text}
          </pre>
          <button
            type="button"
            class="join-diag__copy"
            data-testid="join-diagnostics-copy"
            onClick={() => void copy()}
          >
            {copied ? "Copied" : "Copy diagnostics"}
          </button>
        </div>
      )}
    </section>
  );
}
