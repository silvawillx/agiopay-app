// AGIOPAY — service worker: faz o app ABRIR sem internet.
//
// - Páginas (index.html): tenta a rede primeiro (assim você sempre recebe a
//   versão nova depois de um deploy); sem internet, usa a última cópia salva.
// - Arquivos do app (/assets/*, ícones, fontes): usa a cópia salva e só baixa
//   se ainda não tiver. Os nomes mudam a cada deploy, então nunca fica velho.
// - Dados (Supabase) e a API do /admin: NUNCA passam por cache aqui. Os dados
//   offline ficam guardados pelo próprio app, não pelo service worker.

const CACHE = "agiopay-v2";
const SHELL = ["/", "/index.html", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/favicon-64.png"];
const MAX_ASSETS = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function limitarCache() {
  const c = await caches.open(CACHE);
  const keys = await c.keys();
  const assets = keys.filter((r) => new URL(r.url).pathname.startsWith("/assets/"));
  for (let i = 0; i < assets.length - MAX_ASSETS; i++) await c.delete(assets[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // dados e API: direto pra rede, sem cache
  if (url.pathname.startsWith("/api/") || url.hostname.endsWith(".supabase.co")) return;

  // navegação (abrir o app, /admin, recarregar): rede primeiro, cópia se offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put("/index.html", copia));
          }
          return res;
        })
        .catch(() => caches.match("/index.html").then((r) => r || caches.match("/")))
    );
    return;
  }

  const mesmoSite = url.origin === self.location.origin;
  const fonte = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!mesmoSite && !fonte) return;

  // arquivos do app e fontes: cópia salva primeiro, rede se não tiver
  event.respondWith(
    caches.match(req).then((salvo) => {
      if (salvo) return salvo;
      return fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).then(limitarCache);
        }
        return res;
      });
    })
  );
});
