// Guarda o próprio app no aparelho para abrir sem internet.
// Nunca guarda nada do cofre: só os arquivos do app (HTML, JS, CSS, ícones).
const CACHE = 'chavemestra-app';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Página: tenta a versão nova da internet; sem rede, abre a guardada.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => keep('./', res))
        .catch(() => caches.match('./')),
    );
    return;
  }

  // Demais arquivos têm o conteúdo no nome (ex.: index-ab12.js), então o guardado vale.
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => keep(req, res))),
  );
});

// A cópia precisa ser feita antes de o navegador ler a resposta.
function keep(key, res) {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(key, copy));
  }
  return res;
}
