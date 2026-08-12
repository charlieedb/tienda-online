self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { notification: { body: event.data?.text() || "" } }; }
  const notification = payload.notification || {};
  const data = payload.data || {};
  event.waitUntil(self.registration.showNotification(notification.title || "JOMA Express", {
    body: notification.body || data.body || "Tenés una novedad en la tienda.",
    icon: "/joma-express-icon.png",
    badge: "/joma-express-icon.png",
    data: { url: data.url || "/" },
  }));
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
