---
tags: [ia, desarrollo, api, frameworks, tiempo-real]
creado: 2026-06-22
---

# IA musical — Frameworks, APIs y tiempo real

Con qué se **construye y se integra** la generación musical, y los modelos en **tiempo real** (lo más cercano a Chupits). Cómo funciona por dentro → [[IA musical - Cómo funciona por dentro]].

## Con qué se construyen (open source)
- **PyTorch** + **🤗 Hugging Face Transformers** — stack estándar para entrenar/correr modelos de audio.
- **Meta AudioCraft** (`facebookresearch/audiocraft`) — incluye **MusicGen** (texto→música), **AudioGen** (texto→sonido) y **EnCodec** (codec). MusicGen en 300M / 1.5B / 3.3B parámetros; corre con Transformers ≥4.31. Pesos en Hugging Face.
- **Stable Audio Open 1.0** — difusión latente, licencia **MIT**.
- Despliegue/inferencia: **Hugging Face**, **Replicate**, Colab/TPU.

## APIs para integrar en un producto
| API | Acceso | Notas |
|---|---|---|
| **ElevenLabs Music API** | REST + WebSocket; SDK Python/JS/React/Swift/Kotlin | Control de género/mood/estructura/duración. La más "developer-friendly". |
| **Stability AI — Stable Audio** | API comercial + **Open** (MIT) | Música y SFX, *audio inpainting*. |
| **Google Lyria** | API | Versión **Lyria RealTime** para tiempo real. |
| **Suno** | **Sin API oficial**; wrappers de terceros (AIMLAPI, sunoapi.org) | Riesgo de ToS. |

## Tiempo real (live music models) — lo relevante para Chupits
- **Magenta RealTime** (Google) — transformer autoregresivo **800M**, ~190k h de música, **chunks de 2 s** (2 s generados en ~1.25 s en TPU free). Pipeline: embeddings **MusicCoCa** + codec **SpectroStream** + transformer encoder-decoder. **Pesos abiertos** (GitHub + HF).
- **Lyria RealTime** (Google) — modelo en tiempo real vía API con controles extendidos.
- **RAVE** (Realtime Audio Variational autoEncoder) — síntesis neuronal de onda **20× tiempo real a 48 kHz en CPU**. Para timbres/instrumentos neuronales.

## Dónde encaja Chupits Beat
Chupits NO genera audio neuronal: es un **modelo de lenguaje (Llama 3.3 vía Groq) que escribe código simbólico** (JSON → Strudel), y el **navegador** sintetiza en tiempo real con Web Audio.
- Ventaja: latencia y control total (cambiar un parámetro = reescribir una línea), cero coste de GPU de audio, y **editable en vivo** (live coding).
- Es un enfoque distinto a Magenta RealTime/RAVE (que generan *audio* neuronal): aquí la IA genera **instrucciones**, no ondas. Ver [[IA musical - Cómo funciona por dentro]] y [[Aplicación a Chupits Beat]].

## Fuentes
- [Meta AI — AudioCraft](https://ai.meta.com/blog/audiocraft-musicgen-audiogen-encodec-generative-ai-audio/) · [facebook/musicgen-large (HF)](https://huggingface.co/facebook/musicgen-large)
- [ElevenLabs — Music API](https://elevenlabs.io/music-api)
- [Magenta RealTime (Google)](https://magenta.withgoogle.com/magenta-realtime) · [Live Music Models (arXiv)](https://arxiv.org/html/2508.04651)
