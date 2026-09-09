import { useEffect, useState } from "preact/hooks";
import { useRoute } from "preact-iso";
import { saveDealerToken } from "../sync/dealer-token.js";
import { qrDataUrl } from "../sync/qr.js";
import { tableUrl } from "../sync/urls.js";
import "./table-created.css";

export function TableCreatedPage(_props: { path?: string }) {
  const { params, query } = useRoute();
  const code = params.code ?? "";
  const token = query.t ?? "";
  const [displayQr, setDisplayQr] = useState("");
  const [dealerQr, setDealerQr] = useState("");
  const [playQr, setPlayQr] = useState("");

  const displayUrl = tableUrl(`/display/${code}`);
  const dealerUrl = tableUrl(`/dealer/${code}?t=${encodeURIComponent(token)}`);
  const playUrl = tableUrl(`/play/${code}`);

  useEffect(() => {
    if (token) saveDealerToken(code, token);
  }, [code, token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [d, r, p] = await Promise.all([
        qrDataUrl(displayUrl),
        qrDataUrl(dealerUrl),
        qrDataUrl(playUrl),
      ]);
      if (!cancelled) {
        setDisplayQr(d);
        setDealerQr(r);
        setPlayQr(p);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [displayUrl, dealerUrl, playUrl]);

  return (
    <main class="table-created" data-testid="table-created-page">
      <h1>Table created</h1>
      <p class="table-created__code" data-testid="table-code">
        {code}
      </p>

      <div class="table-created__qrs">
        <section>
          <h2>Display</h2>
          {displayQr && <img src={displayQr} alt="Display QR" data-testid="display-qr" />}
          <a href={displayUrl} data-testid="open-display">
            Open Display here
          </a>
        </section>
        <section>
          <h2>Dealer</h2>
          {dealerQr && <img src={dealerQr} alt="Dealer QR" data-testid="dealer-qr" />}
          <a href={dealerUrl} data-testid="open-dealer">
            Open Dealer here
          </a>
        </section>
        <section>
          <h2>Join (Player)</h2>
          {playQr && <img src={playQr} alt="Join QR" data-testid="play-qr" />}
          <a href={playUrl} data-testid="open-play">
            Open Join here
          </a>
        </section>
      </div>

      <a href="/" class="table-created__home">
        Back to home
      </a>
    </main>
  );
}
