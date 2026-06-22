---
tags: [schranz, teoria, kick, sound-design]
creado: 2026-06-22
---

# Schranz — Diseño del kick (rumble y distorsión)

El kick es **el** elemento central del schranz. Relacionado: [[Schranz - Composición y estructura]], [[Schranz - Percusión y bajo]].

## Los dos kicks del hard techno/schranz
La mayoría de tracks usan **dos** kicks:
1. **Kick principal** — corto, punzante, **distorsionado**, limpio en la negra (downbeat).
2. **Rumble kick** — copia procesada que suena *debajo y después* del transitorio principal, alargando la cola y el grave. Crea ese "groove" rodante.

## Cómo se hace el kick principal (distorsión)
- Partir de un kick limpio con **cola larga** + **mucha distorsión**.
- Cadena típica: *limiter → amp/overdrive → delay → simulación de pedal de guitarra → otro limiter*.
- Algo de **overdrive vía sidechain** para densidad en medios.
- Gestión de frecuencias clave: el grave limpio, los medios saturados.

## Cómo se hace el rumble
1. Copia del kick → **reverb** con wet alto.
2. **Distorsión** (tipo Decapitator) para engordar la cola de reverb.
3. **EQ** para filtrar agudos y dar forma al grave.
4. **Sidechain compression**: el rumble *duckea* con el kick (no se pisan).

## Estilo "gallop" / doble kick rodante
- **Doble kick a contratiempo (offbeat)** → efecto *pumping*.
- **Delay** para el rumble rítmico.
- Sidechain del gallop al kick original → bombea rítmicamente y mantiene la mezcla limpia cuando coinciden.

## Traducción a Chupits Beat (síntesis Strudel)
No tenemos cadena de plugins, pero se aproxima con:
- `s("bd*4")` (o `RolandTR909_bd`) + **`.distort(0.2–0.35)`** (acotado para no saturar — ver [[Aplicación a Chupits Beat]]).
- Acentos con `.gain("<1.0 0.85 0.9 0.8>")`.
- "Rumble" aproximado: capa de bajo con `note(...).s("sawtooth").lpf(bajo).room()` sidechain-eada conceptualmente (gain pattern que abre tras el kick).
- El **gallop**: `s("bd*4")` + capa `s("bd").euclid(3,8)` más floja.

## Fuentes
- [Sounds&Loops — schranz kick en Ableton](https://soundsloops.com/2020/07/18/how-to-make-schranz-kick-samples-in-ableton-daw/)
- [Futureproof Music School — hard techno kick & rumble](https://futureproofmusicschool.com/blog/making-hard-techno-a-path-to-unique-sound-design)
- [The Producer School — rumble kicks 2025](https://theproducerschool.com/blogs/featured-blogs/how-to-create-techno-rumble-kicks-for-2025)
- [Studio Brootle — hard techno bass gallop](https://www.studiobrootle.com/techno-technique-hard-techno-bass-gallop/)
