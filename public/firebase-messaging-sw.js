self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { notification: { body: event.data?.text() || "" } }; }
  const notification = payload.notification || {};
  const data = payload.data || {};
  const storedNotification = {
    id: data.campaignId || `${Date.now()}`,
    title: notification.title || "JOMA Express",
    body: notification.body || data.body || "Tenés una novedad en la tienda.",
    action: data.action || "none",
    target: data.target || "",
    url: data.url || "/",
    audience: data.audience || "all",
    expiresAt: data.expiresAt || "",
    createdAtIso: data.createdAtIso || new Date().toISOString(),
  };
  event.waitUntil(Promise.all([
    self.registration.showNotification(storedNotification.title, {
      body: storedNotification.body,
      icon: "/joma-express-icon.png",
      badge: "/joma-express-icon.png",
      data: { url: storedNotification.url },
    }),
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => client.postMessage({ type: "JOMA_NOTIFICATION_RECEIVED" }));
    }),
    caches.open("joma-notifications").then(async (cache) => {
      const previous = await cache.match("/__joma_notifications__");
      let items = [];
      try { items = previous ? await previous.json() : []; } catch { items = []; }
      const next = [storedNotification, ...items.filter((item) => item?.id !== storedNotification.id)].slice(0, 25);
      await cache.put("/__joma_notifications__", new Response(JSON.stringify(next), { headers: { "Content-Type": "application/json" } }));
    }),
  ]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.focus(); existing.navigate(targetUrl); return; }
    await self.clients.openWindow(targetUrl);
  })());
});
