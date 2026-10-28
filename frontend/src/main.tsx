import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AnalyticsProvider } from "./analytics/AnalyticsProvider";
import { SettingsProvider } from "./settings";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <AnalyticsProvider>
          <App />
        </AnalyticsProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
);
