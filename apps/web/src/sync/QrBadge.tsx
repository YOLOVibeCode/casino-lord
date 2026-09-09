import { useEffect, useState } from "preact/hooks";
import { qrSvg } from "./qr.js";

export interface QrBadgeProps {
  url: string;
  title?: string;
}

export function QrBadge({ url, title = "Display QR" }: QrBadgeProps) {
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

  return (
    <span
      class="qr-badge"
      data-testid="display-qr-badge"
      title={title}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
