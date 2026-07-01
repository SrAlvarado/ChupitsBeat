"""
Análisis de audio PROPIO — el corazón "innovador" del descubrimiento.

Por cada canción calculamos dos cosas a partir del audio real (no de los
metadatos de ninguna plataforma):

  1. Features clásicas interpretables (librosa): BPM, tonalidad, energía,
     brillo, timbre. Sirven para EXPLICAR por qué dos artistas se parecen.
  2. Un embedding neuronal (CLAP) que captura "cómo suena" en un vector de
     512 dimensiones. Es lo que de verdad mide la similitud acústica.

El embedding de un artista = media de los embeddings de sus top tracks.
La similitud entre artistas = coseno entre esos embeddings.
"""
from __future__ import annotations

import os
import tempfile
from dataclasses import asdict, dataclass
from typing import Optional

import numpy as np
import requests

# Sample rates
SR_FEATURES = 22_050   # suficiente para BPM/tonalidad/energía
SR_CLAP = 48_000       # CLAP espera 48 kHz
CLAP_MODEL = "laion/clap-htsat-unfused"

_PITCHES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


@dataclass
class TrackAnalysis:
    bpm: float
    key: str            # p.ej. "F# minor"
    energy: float       # RMS medio (0..~1)
    brightness: float   # centroide espectral normalizado (0..1)
    embedding: Optional[list[float]]  # 512-d CLAP, o None si no disponible

    def to_public(self) -> dict:
        d = asdict(self)
        d.pop("embedding", None)  # el vector no se expone al frontend
        return d


# ---------------------------------------------------------------------------
# Carga de audio
# ---------------------------------------------------------------------------
def _load(path: str, sr: int) -> np.ndarray:
    import librosa
    y, _ = librosa.load(path, sr=sr, mono=True)
    return y


def download_preview(url: str) -> str:
    """Baja un preview (mp3) a un fichero temporal y devuelve la ruta."""
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    fd, path = tempfile.mkstemp(suffix=".mp3")
    with os.fdopen(fd, "wb") as f:
        f.write(r.content)
    return path


# ---------------------------------------------------------------------------
# Features clásicas (interpretables)
# ---------------------------------------------------------------------------
def _classic_features(y: np.ndarray, sr: int) -> dict:
    import librosa

    try:
        tempo = librosa.feature.rhythm.tempo(y=y, sr=sr)
    except AttributeError:
        tempo = librosa.beat.tempo(y=y, sr=sr)
    bpm = float(np.atleast_1d(tempo)[0])

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    pitch_idx = int(np.argmax(chroma.mean(axis=1)))
    # estimación tosca de modo: correlación con perfiles mayor/menor de Krumhansl
    maj = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])
    minp = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
    prof = np.roll(chroma.mean(axis=1), -pitch_idx)
    mode = "major" if np.corrcoef(prof, maj)[0, 1] >= np.corrcoef(prof, minp)[0, 1] else "minor"
    key = f"{_PITCHES[pitch_idx]} {mode}"

    rms = float(np.mean(librosa.feature.rms(y=y)))
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
    brightness = min(1.0, centroid / (sr / 2))

    return {"bpm": round(bpm, 1), "key": key,
            "energy": round(rms, 4), "brightness": round(brightness, 4)}


# ---------------------------------------------------------------------------
# Embedding CLAP (lazy singleton)
# ---------------------------------------------------------------------------
_clap = {"model": None, "proc": None, "ok": None}


def _clap_available() -> bool:
    if _clap["ok"] is not None:
        return _clap["ok"]
    try:
        import torch  # noqa: F401
        from transformers import ClapModel, ClapProcessor
        _clap["model"] = ClapModel.from_pretrained(CLAP_MODEL).eval()
        _clap["proc"] = ClapProcessor.from_pretrained(CLAP_MODEL)
        _clap["ok"] = True
    except Exception as e:  # pragma: no cover
        print(f"[analysis] CLAP no disponible, uso solo features: {e}")
        _clap["ok"] = False
    return _clap["ok"]


def _embed(y48: np.ndarray) -> Optional[list[float]]:
    if not _clap_available():
        return None
    import torch
    try:
        inputs = _clap["proc"](audio=y48, sampling_rate=SR_CLAP, return_tensors="pt")
    except TypeError:
        inputs = _clap["proc"](audios=y48, sampling_rate=SR_CLAP, return_tensors="pt")
    with torch.no_grad():
        out = _clap["model"].get_audio_features(**inputs)
    # transformers 5.x devuelve un objeto; el embedding proyectado (512-d) está
    # en pooler_output. Versiones antiguas devolvían el tensor directamente.
    vec = getattr(out, "pooler_output", out)
    if vec.ndim > 1:
        vec = vec[0]
    vec = vec / vec.norm()  # L2-normalizado → coseno = producto escalar
    return vec.cpu().numpy().astype(np.float32).tolist()


# ---------------------------------------------------------------------------
# API pública
# ---------------------------------------------------------------------------
def analyze_file(path: str) -> TrackAnalysis:
    feats = _classic_features(_load(path, SR_FEATURES), SR_FEATURES)
    emb = _embed(_load(path, SR_CLAP))
    return TrackAnalysis(embedding=emb, **feats)


def analyze_preview(url: str) -> Optional[TrackAnalysis]:
    """Analiza la URL de preview de una canción. None si falla la descarga."""
    path = None
    try:
        path = download_preview(url)
        return analyze_file(path)
    except Exception as e:
        print(f"[analysis] fallo analizando preview {url}: {e}")
        return None
    finally:
        if path and os.path.exists(path):
            os.remove(path)


# ---------------------------------------------------------------------------
# Agregación y similitud
# ---------------------------------------------------------------------------
def aggregate(analyses: list[TrackAnalysis]) -> dict:
    """Perfil acústico de un artista = media de sus tracks analizados."""
    if not analyses:
        return {}
    embs = [np.array(a.embedding) for a in analyses if a.embedding is not None]
    profile_emb = None
    if embs:
        m = np.mean(embs, axis=0)
        n = np.linalg.norm(m)
        profile_emb = (m / n).tolist() if n else m.tolist()
    return {
        "bpm": round(float(np.mean([a.bpm for a in analyses])), 1),
        "energy": round(float(np.mean([a.energy for a in analyses])), 4),
        "brightness": round(float(np.mean([a.brightness for a in analyses])), 4),
        "key": _mode_key([a.key for a in analyses]),
        "embedding": profile_emb,
    }


def merge_profiles(profiles: list[dict]) -> dict:
    """Funde varios perfiles ya agregados en uno (el 'gusto' del usuario)."""
    profiles = [p for p in profiles if p]
    if not profiles:
        return {}
    embs = [np.array(p["embedding"]) for p in profiles if p.get("embedding")]
    emb = None
    if embs:
        m = np.mean(embs, axis=0)
        n = np.linalg.norm(m)
        emb = (m / n).tolist() if n else m.tolist()
    nums = lambda k: [p[k] for p in profiles if p.get(k) is not None]
    return {
        "bpm": round(float(np.mean(nums("bpm"))), 1) if nums("bpm") else 0,
        "energy": round(float(np.mean(nums("energy"))), 4) if nums("energy") else 0,
        "brightness": round(float(np.mean(nums("brightness"))), 4) if nums("brightness") else 0,
        "key": _mode_key([p["key"] for p in profiles if p.get("key")]),
        "embedding": emb,
    }


def _mode_key(keys: list[str]) -> str:
    if not keys:
        return ""
    return max(set(keys), key=keys.count)


def cosine(a: list[float], b: list[float]) -> float:
    va, vb = np.array(a), np.array(b)
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if not na or not nb:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))
