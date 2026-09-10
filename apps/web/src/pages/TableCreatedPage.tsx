import { useEffect, useState } from "preact/hooks";
import { useRoute } from "preact-iso";
import { getTableMeta } from "../sync/api.js";
import { getSyncBaseUrl } from "../sync/config.js";
import { saveDealerToken } from "../sync/dealer-token.js";
import { qrDataUrl } from "../sync/qr.js";
import { tableUrl } from "../sync/urls.js";
import "./table-created.css";

function CopyButton(props: { text: string; label: string; testId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <button
      type="button"
      class="table-created__copy"
      data-testid={props.testId}
      onClick={() => void handleCopy()}
    >
      {copied ? "Copied" : props.label}
    </button>
  );
}

export function TableCreatedPage(_props: { path?: string }) {
  const { params, query } = useRoute();
  const code = params.code ?? "";
  const token = query.t ?? "";
  const game = query.game ?? "";
  const [displayQr, setDisplayQr] = useState("");
  const [dealerQr, setDealerQr] = useState("");
  const [playQr, setPlayQr] = useState("");
  const [enlargedQr, setEnlargedQr] = useState<string | null>(null);
  const [playerModeOn, setPlayerModeOn] = useState<boolean | null>(null);

  const displayUrl = tableUrl(`/display/${code}`);
  const dealerUrl = tableUrl(`/dealer/${code}?t=${encodeURIComponent(token)}`);
  const playUrl = tableUrl(`/play/${code}`);

  useEffect(() => {
    let cancelled = false;
    void getTableMeta(getSyncBaseUrl(), code)
      .then((meta) => {
        if (!cancelled) {
          setPlayerModeOn(meta.participation?.playerMode === "on");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlayerModeOn(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (token) {
      saveDealerToken(code, token, game ? { game } : undefined);
      const params = new URLSearchParams(window.location.search);
      params.delete("t");
      const qs = params.toString();
      history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
  }, [code, token, game]);

  useEffect(() => {
    if (playerModeOn === null) return;

    let cancelled = false;
    void (async () => {
      const qrTasks: Promise<void>[] = [
        qrDataUrl(displayUrl).then((d) => {
          if (!cancelled) setDisplayQr(d);
        }),
        qrDataUrl(dealerUrl).then((d) => {
          if (!cancelled) setDealerQr(d);
        }),
      ];
      if (playerModeOn) {
        qrTasks.push(
          qrDataUrl(playUrl).then((p) => {
            if (!cancelled) setPlayQr(p);
          }),
        );
      } else {
        setPlayQr("");
      }
      await Promise.all(qrTasks);
    })();
    return () => {
      cancelled = true;
    };
  }, [displayUrl, dealerUrl, playUrl, playerModeOn]);

  const qrButton = (src: string, alt: string, testId: string) => (
    <button
      type="button"
      class="table-created__qr-button"
      onClick={() => setEnlargedQr(src)}
      aria-label={`Enlarge ${alt}`}
    >
      <img src={src} alt={alt} data-testid={testId} />
    </button>
  );

  return (
    <main class="table-created" data-testid="table-created-page">
      <h1>Table created</h1>
      <div class="table-created__code-row">
        <p class="table-created__code" data-testid="table-code">
          {code}
        </p>
        <CopyButton text={code} label="Copy code" testId="copy-table-code" />
      </div>

      <ol class="table-created__next" data-testid="table-created-next-steps">
        <li>Open Display on the TV</li>
        <li>Open Dealer on your phone</li>
        {playerModeOn && <li>Players scan Join</li>}
      </ol>

      <div class="table-created__qrs">
        <section>
          <h2>Display QR</h2>
          {displayQr && qrButton(displayQr, "Display QR", "display-qr")}
          <CopyButton text={displayUrl} label="Copy Display URL" testId="copy-display-url" />
          <a href={displayUrl} data-testid="open-display">
            Open Display here
          </a>
        </section>
        <section>
          <h2>Dealer QR</h2>
          {dealerQr && qrButton(dealerQr, "Dealer QR", "dealer-qr")}
          <CopyButton text={dealerUrl} label="Copy Dealer URL" testId="copy-dealer-url" />
          <a href={dealerUrl} data-testid="open-dealer">
            Open Dealer here
          </a>
          <p class="table-created__warning" data-testid="dealer-private-warning">
            Anyone with this link can control the table.
          </p>
        </section>
        {playerModeOn && (
          <section>
            <h2>Player QR</h2>
            {playQr && qrButton(playQr, "Player QR", "play-qr")}
            <CopyButton text={playUrl} label="Copy Join URL" testId="copy-play-url" />
            <a href={playUrl} data-testid="open-play">
              Open Join here
            </a>
          </section>
        )}
      </div>

      {enlargedQr && (
        <div
          class="table-created__lightbox"
          data-testid="qr-lightbox"
          onClick={() => setEnlargedQr(null)}
          role="presentation"
        >
          <img src={enlargedQr} alt="Enlarged QR code" class="table-created__lightbox-img" />
        </div>
      )}

      <a href="/" class="table-created__home">
        Back to home
      </a>
    </main>
  );
}
