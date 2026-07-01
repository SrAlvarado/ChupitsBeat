"""
Caché de perfiles acústicos por artista (clave estable provider:id).

Bajar + analizar el audio de un artista es caro, así que cada perfil
(embedding 512-d + features) se guarda y se reutiliza entre consultas.

Hoy: caché en memoria del proceso. `init_supabase()` permite respaldarla en
una tabla Supabase con pgvector (tarea pendiente). La interfaz no cambia.
"""
from __future__ import annotations

from typing import Optional

_MEM: dict[str, dict] = {}
_MEM_LISTENERS: dict[str, Optional[int]] = {}
_backend = None  # se rellena con init_supabase()


def get_profile(key: str) -> Optional[dict]:
    if key in _MEM:
        return _MEM[key]
    if _backend is not None:
        prof = _backend.get(key)
        if prof is not None:
            _MEM[key] = prof
        return prof
    return None


def put_profile(key: str, profile: dict) -> None:
    _MEM[key] = profile
    if _backend is not None:
        _backend.put(key, profile)


def get_listeners(key: str):
    """Oyentes mensuales cacheados (sentinel: -1 = 'mirado, no encontrado')."""
    if key in _MEM_LISTENERS:
        return _MEM_LISTENERS[key]
    if _backend is not None:
        val = _backend.get_listeners(key)
        if val is not None:
            _MEM_LISTENERS[key] = val
        return val
    return None


def put_listeners(key: str, value: Optional[int]) -> None:
    _MEM_LISTENERS[key] = value
    if _backend is not None:
        _backend.put_listeners(key, value)


def stats() -> dict:
    return {"memory_entries": len(_MEM), "listeners_cached": len(_MEM_LISTENERS),
            "supabase": _backend is not None}


def init_supabase(backend) -> None:
    """Inyecta un backend persistente (debe exponer get(key)/put(key, profile))."""
    global _backend
    _backend = backend
