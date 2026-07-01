"""
Genera una frase editorial ("blurb") del artista con un LLM (Hugging Face),
a partir de sus datos. Le da "alma" a cada póster. Cacheado en memoria.
"""
from __future__ import annotations

import os
from typing import Optional

import requests

HF_URL = "https://router.huggingface.co/v1/chat/completions"
MODEL = "meta-llama/Llama-3.1-8B-Instruct"
_CACHE: dict[str, str] = {}


def generate(name: str, stats: dict, collaborators: list) -> Optional[str]:
    if not name:
        return None
    if name in _CACHE:
        return _CACHE[name]
    key = os.environ.get("HF_TOKEN")
    if not key:
        return None

    top = (stats.get("most_played") or {}).get("title") or "?"
    oldest = (stats.get("oldest") or {}).get("date", "")[:4]
    newest = (stats.get("newest") or {}).get("date", "")[:4]
    collabs = ", ".join(c.get("name", "") for c in (collaborators or [])[:3]) or "—"
    prompt = (
        f"Artista: {name}. {stats.get('albums', 0)} álbumes/EP, {stats.get('singles', 0)} singles, "
        f"{stats.get('tracks', 0)} temas, activo {oldest}-{newest}. Tema más sonado: {top}. "
        f"Colabora con: {collabs}. "
        "Escribe UNA frase (máximo 14 palabras), evocadora y con estilo de crítico musical, "
        "sobre este artista. En español. Sin comillas ni el nombre al principio."
    )
    try:
        r = requests.post(
            HF_URL,
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": "Eres un crítico musical conciso e ingenioso. Respondes SOLO con la frase, sin comillas."},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 60, "temperature": 0.9,
            },
            timeout=30,
        )
        r.raise_for_status()
        txt = r.json()["choices"][0]["message"]["content"].strip().strip('"').strip()
        if txt:
            _CACHE[name] = txt
        return txt or None
    except Exception as e:
        print(f"[blurb] falló ({name}): {e}")
        return None
