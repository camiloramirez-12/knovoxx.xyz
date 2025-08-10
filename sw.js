// Simple offline cache
const CACHE = 'knx-cache-v1';
const ASSETS = [
  '/', '/index.html', '/login.html', '/admin.html', '/client.html',
  '/assets/styles.css','/assets/app.js','/assets/auth.js','/assets/admin.js','/assets/client.js'
];
self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('fetch', (e)=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
