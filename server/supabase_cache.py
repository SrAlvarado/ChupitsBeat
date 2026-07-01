"""
Backend de caché persistente en Supabase (tabla artist_profiles, pgvector).

Implementa la interfaz que espera `cache.py`: get(key) / put(key, profile).
El embedding (lista de 512 floats) se guarda en una columna `vector(512)`;
PostgREST lo intercambia como texto "[v1,v2,...]", así que convertimos en ambos
sentidos.

Activación: si server/.env define SUPABASE_URL y SUPABASE_SERVICE_KEY, main.py
llama a `build()` y lo enchufa con cache.init_supabase().
"""
from __future__ import annotations

import os
from typing import Optional

TABLE = "artist_profiles"


def _emb_to_pg(emb: Optional[list[float]]) -> Optional[str]:
    if not emb:
        return None
    return "[" + ",".join(repr(float(x)) for x in emb) + "]"


def _emb_from_pg(val) -> Optional[list[float]]:
    if val is None:
        return None
    if isinstance(val, list):
        return [float(x) for x in val]
    s = str(val).strip().lstrip("[").rstrip("]")
    return [float(x) for x in s.split(",")] if s else None


class SupabaseCache:
    def __init__(self, client):
        self._c = client

    def get(self, key: str) -> Optional[dict]:
        try:
            res = self._c.table(TABLE).select("*").eq("key", key).limit(1).execute()
            rows = res.data or []
            if not rows:
                return None
            r = rows[0]
            return {
                "bpm": r.get("bpm"),
                "energy": r.get("energy"),
                "brightness": r.get("brightness"),
                "key": r.get("music_key"),
                "embedding": _emb_from_pg(r.get("embedding")),
            }
        except Exception as e:
            print(f"[supabase] get falló ({key}): {e}")
            return None

    def put(self, key: str, profile: dict) -> None:
        try:
            self._c.table(TABLE).upsert({
                "key": key,
                "bpm": profile.get("bpm"),
                "energy": profile.get("energy"),
                "brightness": profile.get("brightness"),
                "music_key": profile.get("key"),
                "embedding": _emb_to_pg(profile.get("embedding")),
            }).execute()
        except Exception as e:
            print(f"[supabase] put falló ({key}): {e}")

    def get_listeners(self, key: str):
        """Oyentes mensuales cacheados. -1 = 'ya mirado, sin dato'. None = no en caché."""
        try:
            res = self._c.table(TABLE).select("monthly_listeners").eq("key", key).limit(1).execute()
            rows = res.data or []
            if not rows:
                return None
            return rows[0].get("monthly_listeners")
        except Exception as e:
            print(f"[supabase] get_listeners falló ({key}): {e}")
            return None

    def put_listeners(self, key: str, value) -> None:
        try:
            # -1 como sentinel de 'mirado pero sin dato' (no re-gastar la API)
            self._c.table(TABLE).upsert({
                "key": key, "monthly_listeners": -1 if value is None else int(value),
            }).execute()
        except Exception as e:
            print(f"[supabase] put_listeners falló ({key}): {e}")


def build() -> Optional[SupabaseCache]:
    """Crea el backend si hay credenciales; si no, devuelve None."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        client = create_client(url, key)
        return SupabaseCache(client)
    except Exception as e:
        print(f"[supabase] no se pudo inicializar: {e}")
        return None
