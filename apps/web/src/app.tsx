import { LocationProvider, Router } from "preact-iso";
import { DealerPage } from "./pages/DealerPage.js";
import { DisplayPage } from "./pages/DisplayPage.js";
import { LandingPage } from "./pages/LandingPage.js";
import { SoloPage } from "./pages/SoloPage.js";
import { SoloDisplayPage } from "./pages/SoloDisplayPage.js";
import { SoloPlayPage } from "./pages/SoloPlayPage.js";
import { SyncErrorPage } from "./pages/SyncErrorPage.js";
import { PlayPage } from "./pages/PlayPage.js";
import { TableCreatedPage } from "./pages/TableCreatedPage.js";
import { VerifyPage } from "./pages/VerifyPage.js";

export function App() {
  return (
    <LocationProvider>
      <Router>
        <LandingPage path="/" />
        <SoloPage path="/solo/:game" />
        <SoloPlayPage path="/solo/:game/play" />
        <SoloDisplayPage path="/solo/:game/display" />
        <PlayPage path="/play/:code" />
        <DealerPage path="/dealer/:code" />
        <DisplayPage path="/display/:code" />
        <TableCreatedPage path="/created/:code" />
        <SyncErrorPage path="/sync-error" />
        <VerifyPage path="/verify" />
      </Router>
    </LocationProvider>
  );
}
