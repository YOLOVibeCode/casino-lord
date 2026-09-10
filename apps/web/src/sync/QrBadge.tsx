import { useEffect, useState } from "preact/hooks";
import { qrSvg } from "./qr.js";

export interface QrBadgeProps {
  url: string;
  title?: string;
  tableCode?: string;
}

export function QrBadge({ url, title = "Display QR", tableCode }: QrBadgeProps) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    void qrSvg(url).then((value) => {
      if (!cancelled) setSvg(value);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!svg) return null;

  const ariaLabel = tableCode ? `Join QR for table ${tableCode}` : title;

  return (
    <span class="qr-badge" data-testid="display-qr-badge" title={title}>
      <span
        class="qr-badge__image"
        role="img"
        aria-label={ariaLabel}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {tableCode && <span class="qr-badge__code">{tableCode}</span>}
    </span>
  );
}
