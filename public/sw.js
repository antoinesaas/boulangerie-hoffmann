// Service worker léger — Boulangerie Hoffmann
// - pages /vendeur/* et /mode : réseau d'abord, copie en cache pour pouvoir rouvrir l'écran hors ligne
// - assets /_next/static : cache d'abord (fichiers versionnés)
// Les commandes elles-mêmes sont mises en file dans localStorage par l'application.

const CACHE = "bg-v2"
const PAGE_HORS_LIGNE = "/offline"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(PAGE_HORS_LIGNE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const requete = event.request
  if (requete.method !== "GET") return
  const url = new URL(requete.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheDabord(requete))
    return
  }

  if (requete.mode === "navigate" && (url.pathname.startsWith("/vendeur") || url.pathname === "/mode")) {
    event.respondWith(reseauDabord(requete))
  }
})

async function cacheDabord(requete) {
  const enCache = await caches.match(requete)
  if (enCache) return enCache
  const reponse = await fetch(requete)
  if (reponse.ok) {
    const cache = await caches.open(CACHE)
    cache.put(requete, reponse.clone())
  }
  return reponse
}

async function reseauDabord(requete) {
  try {
    const reponse = await fetch(requete)
    if (reponse.ok && !reponse.redirected && reponse.type === "basic") {
      const cache = await caches.open(CACHE)
      cache.put(requete, reponse.clone())
    }
    return reponse
  } catch {
    const enCache = await caches.match(requete, { ignoreSearch: true })
    if (enCache) return enCache
    const horsLigne = await caches.match(PAGE_HORS_LIGNE)
    return horsLigne ?? new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  }
}
