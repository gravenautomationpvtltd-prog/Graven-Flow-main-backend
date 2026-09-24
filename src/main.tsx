import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from stale chunk references after a new deploy.
// When the browser's cached index.html points to JS chunks that no longer
// exist, dynamic imports throw "Importing a module script failed" / "Failed
// to fetch dynamically imported module". Reload once to pick up fresh assets.
const STALE_CHUNK_RELOAD_KEY = "__stale_chunk_reloaded_at__";
const isStaleChunkError = (msg: string) =>
  /Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk \d+ failed|error loading dynamically imported module|_result\.default|Cannot read propert(y|ies) of undefined \(reading '?default'?\)|undefined is not an object \(evaluating '.*\.default'\)|Unexpected token '<'|ChunkLoadError|Unable to preload CSS/i.test(
    msg
  );

const getErrorMessage = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if ("message" in value && typeof (value as { message?: unknown }).message === "string") {
      return (value as { message: string }).message;
    }
    if ("reason" in value) {
      return getErrorMessage((value as { reason?: unknown }).reason);
    }
  }

  return "";
};

const tryReloadOnce = () => {
  try {
    const last = Number(sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) || 0);
    // Only auto-reload once per 30s to avoid infinite loops if the error is real.
    if (Date.now() - last > 30_000) {
      sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(Date.now()));
      const url = new URL(window.location.href);
      url.searchParams.set("__lovable_reload", String(Date.now()));
      window.location.replace(url.toString());
    }
  } catch {
    window.location.reload();
  }
};

class StaleChunkBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(error: unknown) {
    if (isStaleChunkError(getErrorMessage(error))) {
      return { hasError: true };
    }

    throw error;
  }

  componentDidCatch(error: unknown, _errorInfo: ErrorInfo) {
    if (isStaleChunkError(getErrorMessage(error))) {
      tryReloadOnce();
      return;
    }

    throw error;
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

window.addEventListener("vite:preloadError", (event) => {
  const maybeError = (event as Event & { payload?: unknown }).payload;
  const msg = getErrorMessage(maybeError);

  if (!msg || isStaleChunkError(msg)) {
    event.preventDefault();
    tryReloadOnce();
  }
});

window.addEventListener("error", (e) => {
  const msg = e?.message || getErrorMessage(e?.error) || getErrorMessage(e);
  if (isStaleChunkError(msg)) tryReloadOnce();
});

window.addEventListener("unhandledrejection", (e) => {
  const msg = getErrorMessage(e?.reason);
  if (isStaleChunkError(msg)) tryReloadOnce();
});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <StaleChunkBoundary>
      <App />
    </StaleChunkBoundary>
  </HelmetProvider>
);
