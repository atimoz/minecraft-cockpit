import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// When we're not inside Tauri (e.g. plain `vite` for UI preview), add a class
// so the body gets a real background instead of transparency.
const isTauri = "__TAURI_INTERNALS__" in window;
if (!isTauri) {
  document.documentElement.classList.add("web-preview");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
