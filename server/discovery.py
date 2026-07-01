"""
Descubrimiento de artistas candidatos — capa AGNÓSTICA de proveedor.

La similitud de verdad la calcula `analysis.py` con el audio real (CLAP +
features). Este módulo solo sirve para dos cosas:
  1. Descubrir artistas candidatos a partir de los favoritos del usuario
     (grafo de "artistas relacionados").
  2. Estimar cómo de "emergente" es cada candidato (proxy de popularidad)
     para poder filtrar los poco conocidos.

Proveedor primario: Deezer (api.deezer.com) — no necesita API key y expone:
  - /search/artist        → resolver un nombre a un artista
  - /artist/{id}/related  → grafo de similitud
  - /artist/{id}/top      → top tracks con `preview` (mp3 de 30s)
  - nb_fan                → proxy de popularidad (filtro de "emergente")

Para enchufar Last.fm / ListenBrainz basta con implementar `DiscoveryProvider`.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Optional

import requests

DEEZER_BASE = "https://api.deezer.com"
_TIMEOUT = 15


@dataclass
class Track:
    """Una canción con (idealmente) una URL de audio analizable."""
    title: str
    preview_url: Optional[str]  # mp3 de ~30s; puede faltar
    provider_id: str
    artist_name: str = ""


@dataclass
class Artist:
    """Un artista normalizado, independientemente del proveedor."""
    provider: str
    provider_id: str
    name: str
    popularity: int  # proxy crudo del proveedor (p.ej. nb_fan de Deezer)
    picture: Optional[str] = None
    link: Optional[str] = None
    top_tracks: list[Track] = field(default_factory=list)
    listeners: Optional[int] = None  # oyentes globales (Last.fm); filtro de emergente

    @property
    def key(self) -> str:
        """Clave estable para deduplicar y cachear."""
        return f"{self.provider}:{self.provider_id}"


class DiscoveryProvider(abc.ABC):
    """Interfaz que cualquier fuente de descubrimiento debe cumplir."""

    name: str

    @abc.abstractmethod
    def resolve_artist(self, query: str) -> Optional[Artist]:
        """Resuelve un nombre escrito por el usuario a un artista concreto."""

    @abc.abstractmethod
    def related(self, artist: Artist, limit: int = 50) -> list[Artist]:
        """Artistas relacionados (vecinos en el grafo de similitud)."""

    @abc.abstractmethod
    def top_tracks(self, artist: Artist, limit: int = 5) -> list[Track]:
        """Top tracks del artista, con URL de preview cuando exista."""


class DeezerProvider(DiscoveryProvider):
    name = "deezer"

    def __init__(self, session: Optional[requests.Session] = None):
        self._s = session or requests.Session()
        self._s.headers.setdefault("User-Agent", "ChupitsDiscovery/0.1")

    def _get(self, path: str, **params) -> dict:
        r = self._s.get(f"{DEEZER_BASE}{path}", params=params, timeout=_TIMEOUT)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict) and data.get("error"):
            raise RuntimeError(f"Deezer error: {data['error']}")
        return data

    def _to_artist(self, d: dict, with_top: bool = False) -> Artist:
        a = Artist(
            provider=self.name,
            provider_id=str(d["id"]),
            name=d.get("name", ""),
            popularity=int(d.get("nb_fan", 0) or 0),
            picture=d.get("picture_medium") or d.get("picture"),
            link=d.get("link"),
        )
        if with_top:
            a.top_tracks = self.top_tracks(a)
        return a

    def resolve_artist(self, query: str) -> Optional[Artist]:
        data = self._get("/search/artist", q=query, limit=1)
        items = data.get("data") or []
        if not items:
            return None
        # /search/artist no trae nb_fan; pedimos la ficha completa
        full = self._get(f"/artist/{items[0]['id']}")
        return self._to_artist(full)

    def related(self, artist: Artist, limit: int = 50) -> list[Artist]:
        data = self._get(f"/artist/{artist.provider_id}/related", limit=limit)
        return [self._to_artist(d) for d in (data.get("data") or [])]

    def top_tracks(self, artist: Artist, limit: int = 5) -> list[Track]:
        data = self._get(f"/artist/{artist.provider_id}/top", limit=limit)
        out: list[Track] = []
        for t in data.get("data") or []:
            out.append(
                Track(
                    title=t.get("title", ""),
                    preview_url=t.get("preview") or None,
                    provider_id=str(t.get("id", "")),
                    artist_name=artist.name,
                )
            )
        return out


# Registro de proveedores. El orden marca la prioridad de descubrimiento.
_PROVIDERS: dict[str, DiscoveryProvider] = {}


def register(provider: DiscoveryProvider) -> None:
    _PROVIDERS[provider.name] = provider


def get_provider(name: str = "deezer") -> DiscoveryProvider:
    if name not in _PROVIDERS:
        raise KeyError(f"proveedor de descubrimiento desconocido: {name}")
    return _PROVIDERS[name]


def providers() -> list[str]:
    return list(_PROVIDERS)


# Deezer disponible por defecto (sin key).
register(DeezerProvider())


def discover_candidates(
    seeds: list[str],
    *,
    max_popularity: int = 50_000,
    per_seed: int = 60,
    provider_name: str = "deezer",
) -> tuple[list[Artist], list[Artist]]:
    """
    A partir de nombres de artistas favoritos, devuelve:
      (seed_artists, candidatos_emergentes)

    `max_popularity` filtra los "emergentes": se descartan candidatos con un
    proxy de popularidad por encima del umbral (p.ej. nb_fan de Deezer).
    Los propios seeds nunca aparecen como candidatos.
    """
    prov = get_provider(provider_name)

    seed_artists: list[Artist] = []
    seed_keys: set[str] = set()
    for q in seeds:
        a = prov.resolve_artist(q)
        if a and a.key not in seed_keys:
            seed_artists.append(a)
            seed_keys.add(a.key)

    candidates: dict[str, Artist] = {}
    for seed in seed_artists:
        for cand in prov.related(seed, limit=per_seed):
            if cand.key in seed_keys or cand.key in candidates:
                continue
            if cand.popularity > max_popularity:
                continue
            candidates[cand.key] = cand

    ranked = sorted(candidates.values(), key=lambda a: a.popularity)
    return seed_artists, ranked
