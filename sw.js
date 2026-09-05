'use strict';

// Increment this version whenever a new application version is published.
const CACHE_NAME = 'vitrines-pwa-v7';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=5',
  './app.js?v=10',
  './recherche.js',
  './catalogue.js',
  './manifest.webmanifest',
  './icons/vitrines-192.png',
  './icons/vitrines-512.png',
  './photos/OBJ-0001.jpg?v=2',
  './photos/OBJ-0002.jpg?v=2',
  './photos/OBJ-0003.jpg?v=2',
  './photos/OBJ-0004.jpg?v=2',
  './photos/OBJ-0005.jpg?v=2',
  './photos/OBJ-0006.jpg?v=2',
  './photos/OBJ-0007.jpg?v=2',
  './photos/OBJ-0008.jpg?v=2',
  './photos/OBJ-0009.jpg?v=2',
  './photos/OBJ-0010.jpg?v=2',
  './photos/OBJ-0011.jpg?v=2',
  './photos/OBJ-0012.jpg?v=2',
  './photos/OBJ-0013.jpg?v=2',
  './photos/OBJ-0014.jpg?v=2',
  './photos/OBJ-0015.jpg?v=2',
  './photos/OBJ-0016.jpg?v=2',
  './photos/OBJ-0017.jpg?v=2',
  './photos/OBJ-0018.jpg?v=2',
  './photos/OBJ-0019.jpg?v=2',
  './photos/OBJ-0020.jpg?v=2',
  './photos/OBJ-0021.jpg?v=2',
  './photos/OBJ-0022.jpg?v=2',
  './photos/OBJ-0023.jpg?v=2',
  './photos/OBJ-0024.jpg?v=2',
  './photos/OBJ-0025.jpg?v=2',
  './photos/OBJ-0026.jpg?v=2',
  './pdf/OBJ-0001_sceau_Montferrand_Pellegrue.pdf',
  './pdf/OBJ-0002_Fibule_dragonesque.pdf',
  './pdf/OBJ-0003_fibule_gallo-romaine.pdf',
  './pdf/OBJ-0004_fibule_ocelles.pdf',
  './pdf/OBJ-0005_fibule_discoidale_emaillee.pdf',
  './pdf/OBJ-0006_fibule_plaque_symetrique_emaillee.pdf',
  './pdf/OBJ-0007_fibule_plaque_rectangulaire_emaillee.pdf',
  './pdf/OBJ-0008_fibule_plaque_rectangulaire_emaillee_losanges.pdf',
  './pdf/OBJ-0009_fibule_plaque_rectangulaire_emaillee_geometrique.pdf',
  './pdf/OBJ-0010_fibule_plaque_losangique_emaillee.pdf',
  './pdf/OBJ-0011_fibule_arquee_ocelles.pdf',
  './pdf/OBJ-0012_fibule_zoomorphe_tortue.pdf',
  './pdf/OBJ-0013_deux_ardillons_boucles_merovingiens.pdf',
  './pdf/OBJ-0014_fibule_aviforme_merovingienne.pdf',
  './pdf/OBJ-0015_garnitures_ceinture_canards_norico-pannoniennes.pdf',
  './pdf/OBJ-0016_paire_extremites_courroie_zoomorphes.pdf',
  './pdf/OBJ-0017_applique_aviforme_franque.pdf',
  './pdf/OBJ-0018_fibule_aviforme_franque.pdf',
  './pdf/OBJ-0019_fibule_aviforme_long_cou.pdf',
  './pdf/OBJ-0020_fibule_zoomorphe_castor_probable.pdf',
  './pdf/OBJ-0021_pendant_harnais_croissant_ocelles.pdf',
  './pdf/OBJ-0022_antoninien_Gallien_Liberalitas_AVGG.pdf',
  './pdf/OBJ-0023_denier_Antonin_le_Pieux_Salus.pdf',
  './pdf/OBJ-0024_bronze_republicain_Janus_proue.pdf',
  './pdf/OBJ-0025_bronze_Antiochos_I_Commagene_aigle.pdf',
  './pdf/OBJ-0026_bronze_Hadrien_Ephese_cerf.pdf',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    })),
  );
});
