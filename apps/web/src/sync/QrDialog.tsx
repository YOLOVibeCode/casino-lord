import { useEffect, useState } from "preact/hooks";
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
}

export function QrDialog({ entries, onClose }: QrDialogProps) {
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const entry of entries) {
        next[entry.label] = await qrDataUrl(entry.url);
      }
      if (!cancelled) setImages(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [entries]);

  return (
    <div class="qr-dialog__backdrop" data-testid="qr-dialog" onClick={onClose}>
      <div class="qr-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Table QR codes</h2>
        {entries.map((entry) => (
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
