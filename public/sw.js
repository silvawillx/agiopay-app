// Service worker mínimo — não faz cache nem funciona offline, só existe
// porque o Chrome/Android exige um service worker registrado com um
// listener de "fetch" pra considerar o app "instalável" na tela inicial.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // intencionalmente vazio: deixa cada requisição seguir direto pra rede
});
