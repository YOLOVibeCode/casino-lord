import { LocationProvider, Router } from "preact-iso";
import { DealerPage } from "./pages/DealerPage.js";
import { DisplayPage } from "./pages/DisplayPage.js";
import { LandingPage } from "./pages/LandingPage.js";
import { SoloPage } from "./pages/SoloPage.js";
import { SyncErrorPage } from "./pages/SyncErrorPage.js";
import { PlayPage } from "./pages/PlayPage.js";
import { TableCreatedPage } from "./pages/TableCreatedPage.js";

export function App() {
  return (
    <LocationProvider>
      <Router>
        <LandingPage path="/" />
        <SoloPage path="/solo/:game" />
        <PlayPage path="/play/:code" />
        <DealerPage path="/dealer/:code" />
        <DisplayPage path="/display/:code" />
        <TableCreatedPage path="/created/:code" />
        <SyncErrorPage path="/sync-error" />
      </Router>
    </LocationProvider>
  );
}
