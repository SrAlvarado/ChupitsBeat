---
tags: [chupitbeats, proyecto, aplicacion]
creado: 2026-06-22
---

# Aplicación a Chupits Beat

Cómo trasladar todo el vault a la app. Hub: [[Índice]].

## Lo que la app ya hace bien (coincide con la teoría)
- **1 BPM + 1 tonalidad de sesión** → beatmatch y mezcla armónica resueltos ([[Mezcla armónica (Camelot)]]).
- **Tempo correcto** `cps = BPM/240` ([[Schranz - Tempo y subdivisión]]).
- **6 pistas por elemento** (KICK, HATS, PERC, BASS, STAB, ATMO) — stems de schranz.
- **Arreglo por fases** (intro→build→peak→breakdown) con curva de energía ([[Schranz - Composición y estructura]]).
- **Jerarquía de mezcla** (kick al frente, atmo al fondo) y **swaps alineados al compás** ([[Transiciones DJ]]).
- **Generación por JSON validado** (anti-crash) + auto-corrección.

## Cómo aplicar cada nota
| Nota | Qué llevar a la app |
|---|---|
| [[Schranz - Tempo y subdivisión]] | BPM 145–160; loops euclídeos `euclid(3,16)/(5,16)`. |
| [[Schranz - Diseño del kick]] | KICK = `bd*4` + `.distort(0.2–0.35)` + acentos; capa "rumble" con bajo filtrado. |
| [[Schranz - Percusión y bajo]] | HATS offbeat (`~ oh ~ oh`), PERC euclídeo, BASS sidechain (gain pattern que abre tras el kick). |
| [[Schranz - Composición y estructura]] | PHASE_ACTIVE ya implementa el arco; afinar qué pistas entran por fase. |
| [[Transiciones DJ]] | Próximo: crossfade de ganancia / bass-swap en vez de swap seco. |
| [[Recursos - Sample packs]] | Ampliar/validar la paleta de sonidos del motor (909/808/acid). |
| [[Recursos - MIDI y melodías]] | Sacar notas en frigio/menor para BASS y STAB. |

## Pendientes / próximos pasos (de los DJs reales)
1. **Crossfade real** en regeneración (bajar viejo / subir nuevo en 1 bar) → menos brusco que el swap. → [[Transiciones DJ]]
2. **Bass-swap** al cambiar BASS/STAB para que no choquen graves.
3. **Filter sweep automático** por fase (LPF que abre en el build) → tensión sin llamar a la IA.
4. **Feedback/steering del usuario** (👍 mantener / cambiar una pista) — lo que hace el [[Índice|AI DJ de Spotify]] con skips/likes.
5. **Rumble kick** dedicado como variante del KICK.

## Nota de copyright
La app **sintetiza** audio (Strudel) y usa samples del motor (909/808 ya incluidos). No reproduce tracks ajenos → sin problema de copyright. El vault es **referencia/inspiración**, no fuente de audio a reproducir. Ver [[Licencias]].
