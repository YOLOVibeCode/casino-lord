import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useDialogA11y } from "../shells/use-dialog-a11y.js";
import { qrDataUrl } from "./qr.js";
import "./qr-dialog.css";

export interface QrEntry {
  label: string;
  url: string;
  warning?: string;
}

export interface QrDialogProps {
  entries: QrEntry[];
  onClose: () => void;
  playerModeOn?: boolean;
  joinUrl?: string;
}

export function buildQrDialogEntries(opts: {
  entries: QrEntry[];
  playerModeOn?: boolean;
  joinUrl?: string;
}): QrEntry[] {
  const { entries, playerModeOn, joinUrl } = opts;
  if (!playerModeOn || !joinUrl) return entries;
  const hasJoin = entries.some((e) => e.label === "Join (Player)");
  if (hasJoin) return entries;
  return [{ label: "Join (Player)", url: joinUrl }, ...entries];
}

function entriesKey(entries: QrEntry[]): string {
  return entries.map((e) => `${e.label}:${e.url}:${e.warning ?? ""}`).join("|");
}

export function QrDialog({ entries, onClose, playerModeOn, joinUrl }: QrDialogProps) {
  const [images, setImages] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const { dialogProps } = useDialogA11y({
    panelRef,
    onClose,
    titleId: "qr-dialog-title",
  });

  const displayEntries = useMemo(
    () => buildQrDialogEntries({ entries, playerModeOn, joinUrl }),
    [entries, playerModeOn, joinUrl],
  );

  const stableKey = useMemo(() => entriesKey(displayEntries), [displayEntries]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const entry of displayEntries) {
        if (!entry.url) continue;
        next[entry.label] = await qrDataUrl(entry.url);
      }
      if (!cancelled) setImages(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [stableKey]);

  return (
    <div class="qr-dialog__backdrop" data-testid="qr-dialog" onClick={onClose}>
      <div ref={panelRef} class="qr-dialog" {...dialogProps} onClick={(e) => e.stopPropagation()}>
        <h2 id="qr-dialog-title">Table QR codes</h2>
        {displayEntries.map((entry) => (
          <section key={entry.label} class="qr-dialog__entry">
            <h3>{entry.label}</h3>
            {entry.warning && <p class="qr-dialog__warning">{entry.warning}</p>}
            {images[entry.label] && (
              <img src={images[entry.label]} alt={`QR for ${entry.label}`} data-testid="qr-image" />
            )}
            <code class="qr-dialog__url">{entry.url}</code>
          </section>
        ))}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
