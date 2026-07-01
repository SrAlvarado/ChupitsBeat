"""
Historial completo de un artista + grafo de colaboraciones (tipo Obsidian).

Todo sale de Deezer (gratis): info, discografía (fechas), tracks con `rank`
(proxy de reproducciones) y, sobre todo, `contributors` por canción, que es lo
que permite construir el grafo: el artista en el centro y una arista hacia cada
artista con el que ha colaborado, etiquetada con la(s) canción(es) compartida(s).
"""
from __future__ import annotations

import concurrent.futures
import time
from typing import Optional

import requests

DEEZER = "https://api.deezer.com"
_TIMEOUT = 15


def _get(session: requests.Session, path: str, **params) -> dict:
    # Deezer limita ~50 req/5s y responde 200 con {"error": {"code": 4}}; reintentar.
    for attempt in range(4):
        r = session.get(f"{DEEZER}{path}", params=params, timeout=_TIMEOUT)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict) and isinstance(data.get("error"), dict) \
                and data["error"].get("code") == 4:
            time.sleep(0.6 * (attempt + 1))
            continue
        return data
    return data


def _all_albums(session: requests.Session, artist_id: str) -> list[dict]:
    """Todos los álbumes del artista (paginando)."""
    out, index = [], 0
    while True:
        d = _get(session, f"/artist/{artist_id}/albums", limit=100, index=index)
        data = d.get("data") or []
        out.extend(data)
        if not d.get("next") or not data:
            break
        index += len(data)
        if index > 600:  # tope de seguridad
            break
    return out


def photo(name: str) -> Optional[dict]:
    """Ligero: solo nombre + foto + link de un artista (para la galería de la landing)."""
    s = requests.Session()
    s.headers.setdefault("User-Agent", "ChupitsDiscovery/0.1")
    found = _get(s, "/search/artist", q=name, limit=1).get("data") or []
    if not found:
        return None
    a = found[0]
    return {
        "name": a.get("name") or name,
        "picture_xl": a.get("picture_xl") or a.get("picture_big") or a.get("picture"),
        "link": a.get("link"),
    }


def history(name: str) -> Optional[dict]:
    """Devuelve el historial + grafo de un artista, o None si no se encuentra."""
    s = requests.Session()
    s.headers.setdefault("User-Agent", "ChupitsDiscovery/0.1")

    found = _get(s, "/search/artist", q=name, limit=1).get("data") or []
    if not found:
        return None
    artist = _get(s, f"/artist/{found[0]['id']}")
    aid = str(artist["id"])

    # Top tracks PRIMERO (lo más importante: rank + contributors para el grafo),
    # antes de las llamadas masivas de álbumes que podrían tocar el rate limit.
    top = (_get(s, f"/artist/{aid}/top", limit=100).get("data")) or []

    albums = _all_albums(s, aid)
    dated = [a for a in albums if a.get("release_date")]
    dated.sort(key=lambda a: a["release_date"])

    # Deezer mezcla álbumes, EPs y singles en /albums → contar por record_type
    def _rt(a):
        return (a.get("record_type") or "").lower()
    n_album = sum(1 for a in albums if _rt(a) == "album")
    n_ep = sum(1 for a in albums if _rt(a) == "ep")
    n_single = sum(1 for a in albums if _rt(a) == "single")

    # El listado de álbumes no trae nb_tracks; lo pedimos por álbum en paralelo
    # (concurrencia baja para no exceder el límite de Deezer).
    def _nb(album):
        try:
            return int(_get(s, f"/album/{album['id']}").get("nb_tracks", 0) or 0)
        except Exception:
            return 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        total_tracks = sum(ex.map(_nb, albums[:150]))
    ranked = [t for t in top if t.get("rank") is not None]
    ranked.sort(key=lambda t: t["rank"], reverse=True)

    def track_card(t: Optional[dict]) -> Optional[dict]:
        if not t:
            return None
        return {"title": t.get("title"), "rank": t.get("rank"),
                "link": t.get("link"), "preview": t.get("preview"),
                "album": (t.get("album") or {}).get("title")}

    # --- Grafo de colaboraciones ---
    # nodo central = el artista; por cada track con >1 contributor, arista a cada
    # colaborador con la canción compartida.
    collabs: dict[str, dict] = {}
    for t in top:
        contribs = t.get("contributors") or []
        if len(contribs) < 2:
            continue
        for c in contribs:
            if str(c.get("id")) == aid:
                continue
            node = collabs.setdefault(str(c.get("id")), {
                "id": str(c.get("id")), "name": c.get("name"),
                "picture": c.get("picture_small"), "link": c.get("link"),
                "tracks": [],
            })
            node["tracks"].append({
                "title": t.get("title"), "link": t.get("link"),
                "preview": t.get("preview"),
                # enlace de búsqueda en Spotify de la colaboración
                "spotify_search": "https://open.spotify.com/search/"
                + requests.utils.quote(f"{t.get('title','')} {c.get('name','')}"),
            })

    return {
        "artist": {
            "id": aid, "name": artist.get("name"),
            "picture": artist.get("picture_medium") or artist.get("picture"),
            "picture_xl": artist.get("picture_xl") or artist.get("picture_big")
            or artist.get("picture_medium"),
            "link": artist.get("link"), "fans": artist.get("nb_fan"),
        },
        "stats": {
            "albums": n_album + n_ep,   # álbumes + EPs reales (sin singles)
            "only_albums": n_album,
            "eps": n_ep,
            "singles": n_single,
            "releases": len(albums),
            "tracks": total_tracks,
            "oldest": {"title": dated[0]["title"], "date": dated[0]["release_date"],
                       "cover": dated[0].get("cover_medium")} if dated else None,
            "newest": {"title": dated[-1]["title"], "date": dated[-1]["release_date"],
                       "cover": dated[-1].get("cover_medium")} if dated else None,
            "most_played": track_card(ranked[0] if ranked else None),
            "least_played": track_card(ranked[-1] if ranked else None),
        },
        "graph": {
            "center": {"id": aid, "name": artist.get("name"),
                       "picture": artist.get("picture_small")},
            "collaborators": sorted(collabs.values(),
                                    key=lambda n: len(n["tracks"]), reverse=True),
        },
    }
