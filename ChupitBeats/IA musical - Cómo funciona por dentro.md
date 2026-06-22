---
tags: [ia, tecnico, modelos, arquitectura]
creado: 2026-06-22
---

# IA musical — Cómo funciona por dentro

Las tripas de la generación musical con IA. Panorama de apps → [[IA musical - Apps y modelos]]. Construcción → [[IA musical - Frameworks, APIs y tiempo real]].

## Paso 1 — Tokenización de audio (el truco clave)
Generar onda muestra a muestra (44.100/seg) es inviable. Solución: **comprimir el audio a "tokens"**.
- **EnCodec** (Meta): codec neuronal que comprime la onda en **códigos latentes** y la reconstruye.
- Usa **RVQ (Residual Vector Quantization)**: varios *codebooks* apilados, cada uno codifica el error del anterior. EnCodec 32 kHz → 4 codebooks × 2048 entradas, ~50 tokens/seg.
- **Compresión ~150:1** → el modelo trabaja en un espacio mucho más pequeño.

## Paso 2 — El modelo generativo (dos enfoques)
### A) Transformer autoregresivo (sobre tokens)
- Predice el **siguiente token** dado todo lo anterior (como un LLM, pero de "vocabulario de audio").
- Ej: **MusicGen** (Meta) = transformer single-stage sobre tokens de EnCodec.
- Salida: secuencia de tokens → **decoder de EnCodec** → onda.

### B) Difusión latente (sobre espectrograma/latente)
- Convierte la música en una "imagen" (espectrograma) o latente.
- Parte de **ruido puro** y entrena un modelo para **quitar ruido paso a paso** hasta un espectrograma realista.
- Ej: **Stable Audio** (Stability AI). Se decodifica de vuelta a audio.

### C) Simbólico (MIDI / notas / código)
- No genera onda: genera **notas, acordes, parámetros**. Modelos tipo **Magenta**, *Music Transformer*.
- Mucho más ligero y **editable**; necesita un sintetizador/motor que lo suene. ← lo de Chupits.

## Por qué importa para Chupits Beat
- Suno/MusicGen producen un **render fijo**: no puedes cambiar el filtro de un hi-hat en vivo. Incompatible con live coding.
- Chupits usa el enfoque **simbólico**: el LLM (Llama 3.3 en Groq) escribe **JSON → código Strudel**, que el navegador sintetiza en tiempo real y se puede modificar parámetro a parámetro. Ver [[Aplicación a Chupits Beat]].

## Fuentes
- [Meta AI — AudioCraft/MusicGen/EnCodec](https://ai.meta.com/blog/audiocraft-musicgen-audiogen-encodec-generative-ai-audio/)
- [Simple and Controllable Music Generation (MusicGen, arXiv)](https://arxiv.org/pdf/2306.05284)
- [Long-form Music Generation with Latent Diffusion (Stable Audio, arXiv)](https://arxiv.org/pdf/2404.10301)
- [Data Science Dojo — 5 modelos de IA musical](https://datasciencedojo.com/blog/5-ai-music-generation-models/)
