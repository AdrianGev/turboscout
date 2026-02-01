// src/sw.js

export function registerSW() {
  if (process.env.NODE_ENV !== "production") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(
        `${process.env.PUBLIC_URL}/service-worker.js` 
      );

      // If there's already a waiting SW, activate it and reload immediately
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        window.location.reload();
        return;
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version ready -> activate and reload
            newWorker.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          }
        });
      });
    } catch (e) {
      // ignore
    }
  });
}
