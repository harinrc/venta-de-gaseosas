self.addEventListener('install', (event) => {
  event.waitUntil(caches.open('gestor-ventas-v2').then((cache) => cache.addAll([
    './', './index.html', './dashboard.html', './inventario.html', './ventas.html', './creditos.html', './reportes.html',
    './css/styles.css', './js/firebase.js', './js/auth.js', './js/app.js', './js/dashboard.js', './js/inventario.js', './js/ventas.js', './js/creditos.js', './js/reportes.js', './js/usuarios.js', './usuarios.html'
  ])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== 'gestor-ventas-v2').map((key) => caches.delete(key)))));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});