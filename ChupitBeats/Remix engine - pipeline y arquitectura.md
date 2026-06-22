---
tags: [chupitbeats, remix, arquitectura, pivot]
creado: 2026-06-22
---

# Remix engine — pipeline y arquitectura

Pivot del proyecto: de **DJ autónomo generativo** a **motor de remix schranz**. Entrada = canción (YouTube/mp3) → análisis → base de schranz → **remix** (canción nueva usando trozos de la original). Hub: [[Índice]].

## Workflow de un remix/bootleg de schranz
1. **Separar acapella/stems** de la original (voz + instrumental).
2. **Analizar** tonalidad, BPM, beats, melodía predominante.
3. **Chopear** voz/melodía en sílabas/loops y reordenar (se usan TROZOS, no la canción entera).
4. **Base nueva de schranz** (~150 BPM) en la tonalidad de la original; o pitch/stretch de la acapella al tono/tempo objetivo. Ver [[Schranz - Composición y estructura]], [[Schranz - Diseño del kick]].
5. **Arreglo tipo viaje**: intro (melodía sola/filtrada) → build → drop (schranz + hook) → breakdown (solo melodía) → drop 2. Ver [[Transiciones DJ]].

## Pipeline técnico
| Paso | Herramienta | Dónde |
|---|---|---|
| YouTube → audio | **yt-dlp + ffmpeg** | Backend (no fiable en navegador) |
| Separar stems | **Demucs v4** (Meta) | Backend (Python) o WASM/ONNX en navegador (pesado) |
| Análisis BPM/tono/melodía/beats/onsets | **essentia.js** (WASM) | Navegador ✓ |
| Time-stretch / pitch-shift | **SoundTouchJS** / **Rubberband-WASM** | Navegador ✓ |
| Base de schranz | motor Strudel (síntesis) **o** samples reales ([[Recursos - Sample packs]]) | Navegador ✓ |
| Render del remix | **OfflineAudioContext** o backend | Cualquiera |

## Decisión de arquitectura (clave)
Las **Supabase Edge Functions NO** pueden correr yt-dlp/Demucs/ffmpeg (sin binarios, límites de tiempo). Opciones:
- **A) Herramienta local** (CLI o Electron): yt-dlp + Demucs en tu máquina. Sin hosting; encaja con el uso personal/copyright. *Recomendada.*
- **B) Backend en la nube** (Node/Python en VPS/Railway/Render): accesible por web; ripear YouTube + remezclar copyright en un servicio público = riesgo legal.
- **C) Navegador puro**: solo mp3 subido (sin YouTube), stems por WASM (lento, descarga modelo grande).

## Copyright
Procesar audio con copyright **en local / uso personal** ≠ ofrecer un **servicio público** que descarga de YouTube y publica remixes. La elección A/B/C va ligada a esto. (El usuario explicará su caso de uso.)

## Prior art (AI remix / genre transfer)
Loudly, OpenMusic AI, Wondera, Soundverse: separan stems → detectan tempo/tono → regeneran beat en el género objetivo manteniendo la voz. Confirma el patrón: **stems + análisis + base nueva + voz original**.

## Fuentes
- [UJAM — cómo hacer un bootleg remix](https://www.ujam.com/tutorials/how-to-make-a-bootleg-remix-from-start-to-finish/) · [SampleFocus — bootleg remixing](https://blog.samplefocus.com/blog/bootleg-remixing/)
- [essentia.js](https://mtg.github.io/essentia.js/) · [Demucs](https://github.com/facebookresearch/demucs) · [yt-dlp](https://github.com/yt-dlp/yt-dlp/) · [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS/)
- [Loudly — AI remixing](https://www.loudly.com/knowledge-base/ai-remixing-tools)
