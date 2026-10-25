// Minimal service worker for the ATHAR & OWL admin app.
// It does no caching: every request goes straight to the network, so the admin always sees live data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
