# ChupitsBeat — Remix Engine (backend local)

Servicio local que hace el procesado pesado del motor de remix: descargar audio
(yt-dlp), separar stems (Demucs) y normalizar (ffmpeg). Uso **personal / local**.

## Requisitos
- `ffmpeg` (ya instalado: `ffmpeg -version`)
- `uv` (ya instalado: `uv --version`)
- Python 3.11 (lo provisiona `uv`)

## Instalar (una vez)
```bash
cd server
uv venv --python 3.11
source .venv/bin/activate
uv pip install -r requirements.txt   # ⚠️ descarga torch + demucs (~1-2 GB)
```

## Arrancar
```bash
cd server
.venv/bin/uvicorn main:app --port 8000
```
Comprobar: http://localhost:8000/health

> [!warning] No uses `--reload` a secas
> WatchFiles vigilaría también `.venv/` y `work/` → bucle de reinicios. Si quieres
> auto-reload solo de tu código:
> `.venv/bin/uvicorn main:app --port 8000 --reload --reload-dir . --reload-exclude '.venv/*' --reload-exclude 'work/*'`

## Endpoints
| Método | Ruta | Body | Devuelve |
|---|---|---|---|
| GET | `/health` | — | estado |
| POST | `/extract` | `{ "url": "https://youtu.be/…" }` | `{ job, source }` (wav) |
| POST | `/upload` | form-data `file` (mp3/wav) | `{ job, source }` (wav) |
| POST | `/stems` | `{ "job": "…" }` | `{ stems: { vocals, drums, bass, other } }` |

Los archivos se sirven en `/files/...` y se guardan en `server/work/` (ignorado por git).

## Prueba rápida (con el venv activo y el server arrancado)
```bash
# extraer de una URL
curl -s -X POST localhost:8000/extract -H 'Content-Type: application/json' \
  -d '{"url":"<URL>"}'
# separar stems (usa el job devuelto)
curl -s -X POST localhost:8000/stems -H 'Content-Type: application/json' \
  -d '{"job":"<JOB>"}'
```

## Notas
- La primera vez que corras `/stems`, Demucs descarga el modelo `htdemucs` (~80 MB).
- En Mac Apple Silicon, Demucs usa CPU/MPS; una canción tarda ~30-90 s.
- **`torchcodec`** es obligatorio: el `torchaudio` moderno guarda los wav vía TorchCodec
  (usa ffmpeg). Sin él, `/stems` falla con `ImportError: TorchCodec is required`.
