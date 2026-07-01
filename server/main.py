"""
ChupitsBeat — Remix Engine (backend LOCAL).

Hace el procesado pesado que el navegador no puede:
  - /extract : descarga audio de una URL (YouTube…) con yt-dlp → wav
  - /upload  : sube un mp3/audio y lo normaliza a wav (ffmpeg)
  - /stems   : separa el audio en stems (vocals/drums/bass/other) con Demucs

Uso personal / local. Ver server/README.md para arrancar.
"""
import glob
import os
import subprocess
import sys
import uuid

import requests
from fastapi import FastAPI, File, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Carga server/.env y, si existe, el .env de la raíz (HF_TOKEN para CLAP, etc.).
try:
    from dotenv import load_dotenv
    _here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(_here, ".env"))
    load_dotenv(os.path.join(_here, "..", ".env"))
except Exception:
    pass

WORK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "work")
os.makedirs(WORK, exist_ok=True)

app = FastAPI(title="ChupitsBeat Remix Engine (local)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local: el frontend en localhost:5180 lo consume
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/files", StaticFiles(directory=WORK), name="files")


@app.on_event("startup")
def _wire_cache():
    """Respaldar la caché de perfiles en Supabase si hay credenciales."""
    import cache
    import supabase_cache
    backend = supabase_cache.build()
    if backend is not None:
        cache.init_supabase(backend)
        print("[startup] caché Supabase activa")
    else:
        print("[startup] caché en memoria (sin credenciales Supabase)")


def _job_dir(job: str) -> str:
    d = os.path.join(WORK, job)
    if not os.path.isdir(d):
        raise HTTPException(404, f"job desconocido: {job}")
    return d


def _source_wav(job_dir: str) -> str:
    """El wav de origen normalizado (prefiere source.wav)."""
    src = os.path.join(job_dir, "source.wav")
    if os.path.exists(src):
        return src
    wavs = glob.glob(os.path.join(job_dir, "*.wav"))
    if not wavs:
        raise HTTPException(404, "el job no tiene audio de origen")
    return wavs[0]


@app.get("/health")
def health():
    return {"ok": True, "engine": "chupits-discovery", "work": WORK}


@app.get("/img")
def img(url: str):
    """Proxy de imágenes (mismo origen + CORS) para poder exportar el póster a PNG."""
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": "ChupitsDiscovery/0.1"})
        r.raise_for_status()
        return Response(content=r.content,
                        media_type=r.headers.get("content-type", "image/jpeg"),
                        headers={"Cache-Control": "public, max-age=86400"})
    except Exception:
        raise HTTPException(502, "no se pudo cargar la imagen")


# ---------------------------------------------------------------------------
# Descubrimiento de artistas emergentes por similitud acústica
# ---------------------------------------------------------------------------
class DiscoverReq(BaseModel):
    seeds: list[str]
    max_listeners: int = 25_000    # filtro de "emergente" (oyentes Last.fm)
    results: int = 12
    analyze_top: int = 20          # cuántos candidatos analizar (coste)


@app.post("/discover")
def discover(req: DiscoverReq):
    """Recomienda artistas emergentes acústicamente similares a los favoritos."""
    import discover_engine
    seeds = [s.strip() for s in req.seeds if s and s.strip()]
    if not seeds:
        raise HTTPException(400, "introduce al menos un artista favorito")
    return discover_engine.discover(
        seeds,
        max_listeners=req.max_listeners,
        results=req.results,
        analyze_top=req.analyze_top,
    )


class BlurbReq(BaseModel):
    name: str
    stats: dict = {}
    collaborators: list = []


@app.post("/blurb")
def blurb_ep(req: BlurbReq):
    """Frase editorial del artista generada por IA (Hugging Face)."""
    import blurb
    return {"blurb": blurb.generate(req.name, req.stats, req.collaborators)}


class HistoryReq(BaseModel):
    name: str


@app.post("/artist-history")
def artist_history(req: HistoryReq):
    """Historial completo de un artista + grafo de colaboraciones."""
    import artist_history as ah
    name = (req.name or "").strip()
    if not name:
        raise HTTPException(400, "introduce un artista")
    data = ah.history(name)
    if data is None:
        raise HTTPException(404, f"no se encontró el artista: {name}")
    return data


@app.get("/artist-photo")
def artist_photo(q: str):
    """Foto + nombre de un artista (ligero, para la galería de pósters de la landing)."""
    import artist_history as ah
    name = (q or "").strip()
    if not name:
        raise HTTPException(400, "introduce un artista")
    data = ah.photo(name)
    if data is None:
        raise HTTPException(404, f"no se encontró el artista: {name}")
    return data


class ExtractReq(BaseModel):
    url: str


@app.post("/extract")
def extract(req: ExtractReq):
    """Descarga el audio de una URL (YouTube, etc.) y lo deja en wav."""
    job = uuid.uuid4().hex[:12]
    out = os.path.join(WORK, job)
    os.makedirs(out, exist_ok=True)
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "-x", "--audio-format", "wav",
        "--no-playlist",
        "-o", os.path.join(out, "source.%(ext)s"),
        req.url,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise HTTPException(500, f"yt-dlp falló: {r.stderr[-800:]}")
    src = _source_wav(out)
    return {"job": job, "source": f"/files/{job}/{os.path.basename(src)}"}


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    """Sube un audio (mp3/wav/…) y lo normaliza a wav 44.1k."""
    job = uuid.uuid4().hex[:12]
    out = os.path.join(WORK, job)
    os.makedirs(out, exist_ok=True)
    raw = os.path.join(out, "upload_" + os.path.basename(file.filename or "audio"))
    with open(raw, "wb") as f:
        f.write(await file.read())
    dst = os.path.join(out, "source.wav")
    r = subprocess.run(["ffmpeg", "-y", "-i", raw, "-ar", "44100", dst], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(dst):
        raise HTTPException(500, f"ffmpeg falló: {r.stderr[-800:]}")
    return {"job": job, "source": f"/files/{job}/source.wav"}


class StemsReq(BaseModel):
    job: str
    model: str = "htdemucs"


@app.post("/stems")
def stems(req: StemsReq):
    """Separa el audio del job en stems con Demucs."""
    out = _job_dir(req.job)
    src = _source_wav(out)
    cmd = [sys.executable, "-m", "demucs", "-n", req.model, "-o", out, src]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise HTTPException(500, f"demucs falló: {r.stderr[-800:]}")
    dirs = glob.glob(os.path.join(out, req.model, "*"))
    if not dirs:
        raise HTTPException(500, "demucs no generó stems")
    stem_dir = dirs[0]
    stems_out = {}
    for name in ("vocals", "drums", "bass", "other"):
        p = os.path.join(stem_dir, f"{name}.wav")
        if os.path.exists(p):
            stems_out[name] = "/files/" + os.path.relpath(p, WORK).replace(os.sep, "/")
    return {"job": req.job, "stems": stems_out}
