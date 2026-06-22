---
tags: [schranz, teoria, tempo, ritmo]
creado: 2026-06-22
---

# Schranz — Tempo y subdivisión

Cómo funciona el tempo y cómo se reparte el pulso. Base para [[Schranz - Composición y estructura]] y [[Aplicación a Chupits Beat]].

## Tempo (BPM)
- **Techno general:** 120–135 BPM (lento = hipnótico, rápido = agresivo).
- **Hard techno:** ~130–150 BPM.
- **Schranz:**
  - Clásico (Chris Liebing, ~2000s): **145–155 BPM**.
  - Moderno / revival: **150–160 BPM**.
  - Extremo: **160–180+ BPM**.
- Carácter: 4/4 **recto**, swing mínimo, sensación de **locomotora** implacable.

## Compás y frase
- Casi siempre **4/4**: 4 negras (beats) por compás (*bar*).
- **4-on-the-floor**: el bombo cae en cada una de las 4 negras.
- Los compases se agrupan en **4 / 8 / 16 / 32** = frases (la unidad con la que entra/sale cada elemento).

## Subdivisión del pulso (rejilla de 16)
| Subdivisión | Por compás | Uso en schranz |
|---|---|---|
| 1/4 (negra) | 4 | Bombo 4-on-floor |
| 1/8 (corchea) | 8 | Hats; el **offbeat** ("y") es la marca de casa |
| 1/8 offbeat | 4 | Open hat entre bombos |
| 1/16 (semicorchea) | 16 | Rolls, hats frenéticos, percusión rodante |
| Loop de 3 ó 5 pasos | 3/5 sobre 16 | Loops sincopados = ritmo **euclídeo** (`euclid(3,16)`, `euclid(5,16)`) |

> [!tip] La técnica del "loop schranz"
> Coger un loop corto de **3 o 5 semicorcheas** y repetirlo sobre el compás de 16 → no encaja en la rejilla de 4 → ese *rolling* hipnótico sincopado. = ritmo euclídeo.

## Mapeo a Strudel (Chupits Beat)
- Strudel usa **cps** (cycles per second), no BPM. Con 1 ciclo = 1 compás 4/4:
  - **`cps = BPM / 240`** (equivalente `setcpm(BPM/4)`).
  - Ej: 150 BPM → `cps = 0.625`. Default de Strudel `0.5` = 120 BPM.
- `s("bd*4")` = 4 kicks por ciclo = los 4 beats del 4/4.

## Fuentes
- [Strudel — Understanding Cycles](https://strudel.cc/understand/cycles/) · [Strudel FAQ tempo](https://doc.patternclub.org/s/yLuelHzj2)
- [RateYourMusic — Schranz](https://rateyourmusic.com/genre/schranz/) · [Studio Brootle — patrones techno](https://www.studiobrootle.com/techno-drum-patterns-and-drum-programming-tips/)
