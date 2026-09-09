import { LocationProvider, Router } from "preact-iso";
import { LandingPage } from "./pages/LandingPage.js";
import { SoloPage } from "./pages/SoloPage.js";

export function App() {
  return (
    <LocationProvider>
      <Router>
        <LandingPage path="/" />
        <SoloPage path="/solo/:game" />
      </Router>
    </LocationProvider>
  );
}
