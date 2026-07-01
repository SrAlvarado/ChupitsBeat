"""
Orquestación del descubrimiento: une descubrimiento + análisis + scoring.

Flujo:
  favoritos (nombres)
    → resolver artistas + perfil acústico de gusto (media de sus tracks)
    → candidatos emergentes (grafo de relacionados, filtrados por popularidad)
    → analizar cada candidato (CLAP + features sobre su preview)
    → puntuar por similitud acústica + features interpretables
    → top N rankeado, con desglose explicado

El análisis de cada artista se cachea (clave estable provider:id) para no
re-bajar/re-analizar el mismo audio. Hoy la caché es en memoria; `cache.py`
la respaldará en Supabase/pgvector.
"""
from __future__ import annotations

from typing import Optional

import analysis
import discovery
import popularity
import scoring
from cache import get_profile as cache_get, put_profile as cache_put
from cache import get_listeners as listeners_get, put_listeners as listeners_put

# Máximo de artistas NUEVOS (no cacheados) a los que consultamos oyentes de
# Spotify por búsqueda. Acota el gasto del tier gratis (150 req/mes); los ya
# cacheados en Supabase no cuentan y son gratis.
SPOTIFY_LOOKUP_CAP = 20

_MISS = object()  # marcador interno: no cacheado


def _listeners_lookup(artist: discovery.Artist, pop):
    """
    Oyentes de Spotify desde caché si existe; si no, _MISS (requiere API).
    Devuelve int, None ('no en Spotify') o _MISS ('hay que consultar la API').
    """
    cached = listeners_get(artist.key)
    if cached is not None:
        return None if cached == -1 else cached
    return _MISS


def _listeners_fetch(artist: discovery.Artist, pop):
    """Consulta la API (gasta cuota) y cachea el resultado definitivo."""
    try:
        val = pop.listeners(artist.name)
    except Exception as e:  # límite/red/403: NO cachear, se reintenta otro día
        print(f"[discover] lookup transitorio de {artist.name}: {e}")
        return None
    listeners_put(artist.key, val)  # int o None→-1, compartido entre usuarios
    return val


def _preview_for(artist: discovery.Artist, provider: discovery.DiscoveryProvider):
    """URL de preview del artista para reproducir en el frontend."""
    if not artist.top_tracks:
        artist.top_tracks = provider.top_tracks(artist, limit=1)
    for t in artist.top_tracks:
        if t.preview_url:
            return t.preview_url
    return None


def build_profile(artist: discovery.Artist, *, tracks: int = 2,
                  provider: discovery.DiscoveryProvider) -> dict:
    """Perfil acústico de un artista (cacheado por su key)."""
    # Solo vale el cacheado si tiene embedding. Una fila puede existir con solo
    # los oyentes (monthly_listeners) y sin audio; eso NO es un perfil válido.
    cached = cache_get(artist.key)
    if cached and cached.get("embedding"):
        return cached

    if not artist.top_tracks:
        artist.top_tracks = provider.top_tracks(artist, limit=tracks)

    results = []
    for t in artist.top_tracks[:tracks]:
        if t.preview_url:
            r = analysis.analyze_preview(t.preview_url)
            if r:
                results.append(r)

    profile = analysis.aggregate(results)
    # No cachear perfiles vacíos: un fallo puntual de análisis no debe excluir
    # al artista para siempre (se reintentará en la próxima búsqueda).
    if profile.get("embedding"):
        cache_put(artist.key, profile)
    return profile


def discover(
    seeds: list[str],
    *,
    max_listeners: int = 25_000,
    candidate_pool: int = 50,
    hops: int = 2,
    analyze_top: int = 20,
    results: int = 12,
    seed_tracks: int = 2,
    cand_tracks: int = 1,
    provider_name: str = "deezer",
) -> dict:
    """Devuelve {seeds, taste, recommendations} listo para el frontend."""
    prov = discovery.get_provider(provider_name)
    pop = popularity.build()  # contraste de oyentes (Last.fm) o None

    # 1) Resolver favoritos
    seed_artists: list[discovery.Artist] = []
    seen: set[str] = set()
    for q in seeds:
        a = prov.resolve_artist(q)
        if a and a.key not in seen:
            seed_artists.append(a)
            seen.add(a.key)
    if not seed_artists:
        return {"error": "no se reconoció ningún artista de los introducidos",
                "seeds": seeds, "recommendations": []}

    # 2) Perfil de gusto = media de los perfiles de los favoritos
    seed_profiles = [build_profile(s, tracks=seed_tracks, provider=prov)
                     for s in seed_artists]
    taste = analysis.merge_profiles(seed_profiles)
    if not taste.get("embedding"):
        return {"error": "no se pudo analizar el audio de los favoritos",
                "seeds": [s.name for s in seed_artists], "recommendations": []}

    # 3) Reunir candidatos. Los "relacionados" directos son todos artistas ya
    #    grandes, así que damos 2 saltos por el grafo para alcanzar la cola larga
    #    (artistas pequeños). Es gratis: Deezer no tiene límite de cuota.
    pool: dict[str, discovery.Artist] = {}
    frontier: list[discovery.Artist] = []
    for s in seed_artists:
        for c in prov.related(s, limit=candidate_pool):
            if c.key not in seen and c.key not in pool:
                pool[c.key] = c
                frontier.append(c)
    for _ in range(max(0, hops - 1)):
        nxt: list[discovery.Artist] = []
        for c in frontier:
            for c2 in prov.related(c, limit=candidate_pool):
                if c2.key not in seen and c2.key not in pool:
                    pool[c2.key] = c2
                    nxt.append(c2)
        frontier = nxt
    candidates = list(pool.values())

    # 4) Filtro de "emergente" con OYENTES MENSUALES DE SPOTIFY (vía RapidAPI).
    #    Cache compartida primero (gratis); las consultas nuevas a la API van
    #    secuenciales, con presupuesto y parada anticipada para cuidar la cuota.
    source = "deezer_fans"
    api_calls = 0
    if pop is not None:
        source = "spotify_monthly_listeners"
        candidates.sort(key=lambda c: c.popularity)  # menos fans de Deezer primero
        survivors: list[discovery.Artist] = []
        budget = SPOTIFY_LOOKUP_CAP
        for c in candidates:
            val = _listeners_lookup(c, pop)        # cache (gratis)
            if val is _MISS:                        # no cacheado → API
                if budget <= 0:
                    continue
                budget -= 1
                api_calls += 1
                val = _listeners_fetch(c, pop)
            c.listeners = val
            if val is not None and val <= max_listeners:
                survivors.append(c)
                if len(survivors) >= analyze_top:   # ya tenemos suficientes
                    break
        survivors.sort(key=lambda c: c.listeners)
        candidates = survivors
    else:
        candidates = [c for c in candidates if c.popularity <= max_listeners]
        candidates.sort(key=lambda c: c.popularity)

    # 5) Analizar acústicamente los más emergentes y puntuar
    recs = []
    for cand in candidates[:analyze_top]:
        prof = build_profile(cand, tracks=cand_tracks, provider=prov)
        if not prof.get("embedding"):
            continue
        comp = scoring.compatibility(taste, prof)
        recs.append({
            "name": cand.name,
            "provider": cand.provider,
            "provider_id": cand.provider_id,
            "popularity": cand.popularity,
            "listeners": cand.listeners,
            "picture": cand.picture,
            "link": cand.link,
            "preview": _preview_for(cand, prov),
            "compatibility": comp["score"],
            "reasons": comp["reasons"],
            "audio": {k: prof.get(k) for k in ("bpm", "key", "energy", "brightness")},
        })

    recs.sort(key=lambda r: r["compatibility"], reverse=True)
    return {
        "seeds": [s.name for s in seed_artists],
        "taste": {k: v for k, v in taste.items() if k != "embedding"},
        "popularity_source": source,
        "spotify_api_calls": api_calls,
        "candidates_found": len(candidates),
        "analyzed": len(recs),
        "recommendations": recs[:results],
    }
