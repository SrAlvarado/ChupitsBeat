---
tags: [ia, modelos, generacion-musical]
creado: 2026-06-22
---

# IA musical — Apps y modelos (panorama 2026)

Qué herramientas de IA generan música, qué producen y su situación legal. Cómo funcionan por dentro → [[IA musical - Cómo funciona por dentro]].

## Generadores de canción completa (texto → audio)
| Herramienta | Qué hace | Notas |
|---|---|---|
| **Suno** (v5/v5.5) | Canción completa desde prompt (letra, melodía, arreglo, mezcla) | Líder (~67% cuota, 12M usuarios). **Sin API pública oficial**; litigios de copyright abiertos. |
| **Udio** | Top en voces, stems en 20–40 s | Acuerdo con Universal (UMG×Udio 2026) → historia de licencia más limpia. |
| **Stable Audio** (Stability AI) | Sound design, camas instrumentales, clips ~47 s | **Difusión latente**. Versión abierta **Stable Audio Open 1.0** (MIT, menor calidad). |
| **ElevenLabs Music** | Música desde prompt, control de género/mood/estructura | **API REST + WebSocket** con SDKs (Python, JS, React…). |
| **Google Lyria / Lyria RealTime** | Generación de música; versión en tiempo real vía API | Ver [[IA musical - Frameworks, APIs y tiempo real]]. |
| **AIVA** | Composición clásica/orquestal | Entrenado con ~30.000 partituras; salida estructurada/emotiva. |

## El gran eje: audio vs simbólico
- **Generación de AUDIO** (Suno, Udio, MusicGen, Stable Audio): la salida es **onda/audio**. Realista, pero **monolítico** — no editable parámetro a parámetro, pesado, no pensado para control en vivo.
- **Generación SIMBÓLICA** (MIDI, código): la salida son **notas/parámetros/código**. Ligera, editable, controlable en vivo; necesita un motor de sonido. ← **El paradigma de Chupits Beat** (LLM → JSON → Strudel). Ver [[IA musical - Frameworks, APIs y tiempo real]] y [[Aplicación a Chupits Beat]].

## Situación legal (2026)
- Dividido entre **litigio activo** (Suno) y **entrenamiento licenciado/acordado** (Udio, Stable Audio, ElevenLabs, AIVA).
- Para hobby da igual; para **sync comercial / sellos / distribución masiva** importa mucho. Ver [[Licencias]].

## Fuentes
- [Chartlex — comparativa Suno vs Udio 2026](https://www.chartlex.com/blog/marketing/ai-music-generator-comparison-2026)
- [ModelHunter — 10 mejores modelos 2026](https://modelhunter.ai/blog/best-ai-music-generation-models-2026)
- [Decrypt — ElevenLabs/Stability nuevos modelos](https://decrypt.co/369237/elevenlabs-stability-ai-new-music-models-suno)
