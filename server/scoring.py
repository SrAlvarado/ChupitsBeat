"""
Compatibilidad entre el "perfil de gusto" del usuario y un artista candidato.

La nota principal sale de la distancia acústica (coseno de embeddings CLAP).
Las features clásicas (BPM, tonalidad, energía, brillo) sirven para EXPLICAR
la recomendación: el usuario ve por qué se le sugiere ese artista.
"""
from __future__ import annotations

from analysis import cosine

# Pesos de la nota final. El sonido (embedding) manda; el resto matiza.
W_ACOUSTIC = 0.70
W_BPM = 0.12
W_KEY = 0.10
W_ENERGY = 0.08


def _bpm_score(a: float, b: float) -> float:
    if not a or not b:
        return 0.0
    diff = abs(a - b)
    # mismo tempo (±4) ≈ 1.0; a 30 BPM de distancia ≈ 0
    return max(0.0, 1.0 - diff / 30.0)


def _energy_score(a: float, b: float) -> float:
    return max(0.0, 1.0 - abs(a - b) / 0.5)


def compatibility(seed: dict, cand: dict) -> dict:
    """
    Devuelve {score: 0..100, acoustic: 0..1, reasons: [str], ...}.
    `seed` y `cand` son perfiles de `analysis.aggregate`.
    """
    acoustic = 0.0
    if seed.get("embedding") and cand.get("embedding"):
        # el coseno CLAP suele caer en ~[0.3, 0.95]; lo reescalamos a 0..1
        raw = cosine(seed["embedding"], cand["embedding"])
        acoustic = max(0.0, min(1.0, (raw - 0.3) / 0.6))

    bpm_s = _bpm_score(seed.get("bpm", 0), cand.get("bpm", 0))
    key_match = bool(seed.get("key") and seed.get("key") == cand.get("key"))
    energy_s = _energy_score(seed.get("energy", 0), cand.get("energy", 0))

    score = (
        W_ACOUSTIC * acoustic
        + W_BPM * bpm_s
        + W_KEY * (1.0 if key_match else 0.0)
        + W_ENERGY * energy_s
    )

    reasons: list[str] = []
    if acoustic >= 0.75:
        reasons.append("Huella acústica muy cercana")
    elif acoustic >= 0.5:
        reasons.append("Huella acústica parecida")
    if bpm_s >= 0.8:
        reasons.append(f"BPM similar (~{round(cand.get('bpm', 0))})")
    if key_match:
        reasons.append(f"Misma tonalidad ({cand.get('key')})")
    if energy_s >= 0.8:
        level = "muy alta" if cand.get("energy", 0) > 0.2 else "similar"
        reasons.append(f"Energía {level}")

    return {
        "score": round(score * 100),
        "acoustic": round(acoustic, 3),
        "bpm_match": round(bpm_s, 3),
        "key_match": key_match,
        "energy_match": round(energy_s, 3),
        "reasons": reasons or ["Coincidencia general de estilo"],
    }
