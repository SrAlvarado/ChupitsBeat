"""
Contraste de popularidad con OYENTES MENSUALES DE SPOTIFY — GRATIS e ILIMITADO.

Es el único número que refleja bien la popularidad real en todos los géneros
(Deezer `nb_fan` y Last.fm `listeners` infravaloran muchísimo el reggaetón/urbano
latino). Spotify no lo da en su API, y los scrapers de RapidAPI tienen cuotas
ridículas (150/mes en el tier gratis).

Solución: leerlo nosotros de la página pública del artista con un navegador
headless (Playwright). Sin cuota, sin coste, dato exacto. Contrapartida: cada
artista nuevo tarda unos segundos (luego queda cacheado en Supabase, compartido).

Playwright es "thread-affine": el navegador se maneja en UN solo hilo dedicado,
así que todas las consultas se serializan ahí (lo que además es amable con Spotify).
"""
from __future__ import annotations

import re
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from urllib.parse import quote

_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
_BASE = "https://open.spotify.com"


class TransientError(Exception):
    """Fallo temporal (red/carga). NO se debe cachear como 'sin dato'."""


class SpotifyScraper:
    name = "spotify_playwright"

    def __init__(self):
        # Un único hilo dueño del navegador (Playwright sync no es multihilo).
        self._ex = ThreadPoolExecutor(max_workers=1)
        self._local = threading.local()

    # --- todo lo siguiente corre SIEMPRE en el hilo del executor ---
    def _page(self):
        if getattr(self._local, "page", None) is not None:
            return self._local.page
        from playwright.sync_api import sync_playwright
        pw = sync_playwright().start()
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page(locale="en-US", user_agent=_UA)
        self._local.pw, self._local.browser, self._local.page = pw, browser, page
        return page

    def _reset(self):
        try:
            self._local.browser.close()
            self._local.pw.stop()
        except Exception:
            pass
        self._local.page = self._local.browser = self._local.pw = None

    def _goto(self, url: str):
        from playwright.sync_api import Error as PWError
        page = self._page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            return page
        except PWError as e:
            self._reset()  # el navegador pudo morir; se relanza en el próximo intento
            raise TransientError(str(e))

    def _artist_id(self, name: str) -> Optional[str]:
        page = self._goto(f"{_BASE}/search/{quote(name)}/artists")
        try:
            page.wait_for_selector('a[href^="/artist/"]', timeout=12000)
        except Exception:
            return None  # sin resultados de artista
        href = page.eval_on_selector('a[href^="/artist/"]', 'el=>el.getAttribute("href")')
        return href.split("/artist/")[1].split("?")[0] if href else None

    def _listeners(self, name: str, spotify_id: Optional[str]) -> Optional[int]:
        sid = spotify_id or self._artist_id(name)
        if not sid:
            return None  # no está en Spotify
        page = self._goto(f"{_BASE}/artist/{sid}")
        try:
            page.wait_for_selector("text=/monthly listeners/i", timeout=12000)
        except Exception:
            raise TransientError("no apareció 'monthly listeners' (carga lenta)")
        body = page.inner_text("body")
        m = re.search(r"([0-9.,]+)\s*monthly listeners", body, re.I)
        if not m:
            raise TransientError("texto de oyentes no encontrado")
        return int(re.sub(r"\D", "", m.group(1)))

    # --- API pública (thread-safe: delega en el hilo del navegador) ---
    def artist_id(self, name: str) -> Optional[str]:
        return self._ex.submit(self._artist_id, name).result()

    def listeners(self, name: str, spotify_id: Optional[str] = None) -> Optional[int]:
        return self._ex.submit(self._listeners, name, spotify_id).result()


_INSTANCE: Optional[SpotifyScraper] = None


def build() -> Optional[SpotifyScraper]:
    """Devuelve el scraper (singleton) si Playwright está disponible; si no, None."""
    global _INSTANCE
    if _INSTANCE is not None:
        return _INSTANCE
    try:
        import playwright.sync_api  # noqa: F401
    except Exception:
        print("[popularity] Playwright no instalado; se usará el proxy de Deezer")
        return None
    _INSTANCE = SpotifyScraper()
    return _INSTANCE
