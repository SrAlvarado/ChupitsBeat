# Investigación · Estética Y2K skater + Walkman (para la landing)

> Investigación (no implementación). Fecha: 2026-07-04.
> Encargo: ambientar la landing en los **2000 época skater** y en la **época del Walkman**,
> con **animación 3D integrada**, **sin degradados de color** y **sin tipografía común**.
> Complementa a `investigacion-webs-3d.md` (que cubre la parte técnica del 3D).

---

## 0. La tensión clave (y cómo resolverla)

El "Y2K de manual" que sale en todos los artículos es **cromados + degradados metálicos + fuentes burbuja**.
Eso **choca de frente** con tu regla de *sin degradados*. La solución es tirar de las dos vertientes del
2000 que SON planas por naturaleza:

1. **Skater 2000 / zine punk** — DIY, fotocopia, trama de puntos (halftone), collage, pegatinas,
   colores **planos** de tinta, tipografía recortada/ransom. Nada de degradados: el volumen se consigue
   con **sombras duras desplazadas** (offset) y **tramas**, no con gradientes.
2. **Walkman / cassette futurism** — plástico moldeado mate, pantallas **LCD de segmentos**, cintas
   girando, botones físicos, etiquetas técnicas y *warning labels*. Paleta grafito/beige + un **LED**
   de acento (rojo o verde). También plano.

Fusionadas = "mixtape de skate": objeto físico analógico + actitud callejera. Encaja con ChupitsBeats
(convertir un artista en un objeto editorial/físico coleccionable).

---

## 1. Reglas duras derivadas de tus restricciones

- **CERO degradados.** Sustituir por:
  - **Colores planos** (spot colors de serigrafía).
  - **Sombras duras con offset** (`box-shadow: 8px 8px 0 #000`, sin blur) para el "3D barato" de la época.
  - **Tramas / halftone / semitono** para dar textura y falso volumen.
  - En 3D: materiales **mate/toon** (`MeshToonMaterial`, flat shading, outline), **nunca** metal glossy
    ni bloom fuerte (eso es degradado en movimiento). → Hay que rebajar el Bloom actual.
- **Tipografía NO común.** Fuera Anton / Bebas / Archivo (las que usamos ahora, muy vistas). Ver §4.

---

## 2. Mundo A — Skater 2000 / zine punk

**Recursos visuales:** collage cut-and-paste, hand-lettering, ransom-note (letras recortadas de revista),
stencil, sellos de goma, **fotocopia en B/N (xerox)**, serigrafía. Filosofía: rápido, sucio, sin pulir.
Tipografía deliberadamente **desalineada y cruda**.

**Traducción a la web:**
- Fondo tipo **papel/cartón** o negro mate con **ruido y grano**.
- **Halftone** en las fotos (ya lo tenemos en los pósters → coherente).
- **Pegatinas** rotadas (slap stickers), cinta adhesiva, sellos "PARENTAL ADVISORY", códigos de barras.
- **Grip tape** (textura de lija) como fondo de secciones.
- Colores planos: naranja quemado, negro, blanco roto/crema + **un** flúor de acento.

## 3. Mundo B — Walkman / cassette futurism

**Recursos visuales:** plástico moldeado (mate, con brillos duros puntuales, no degradados), **LCD verde/rojo
de segmentos**, cintas de casete con carretes girando, botones físicos rectangulares (PLAY/STOP/REW/FF),
etiquetas técnicas con letra pequeña, tornillos, rejillas de altavoz, *warning labels*. Paleta
**gris/beige monocroma** con el **glow de un LED** (rojo, verde o azul).

**Traducción a la web:**
- El **reproductor** como motivo: barra superior estilo Walkman, botones físicos de navegación.
- **Pantalla LCD de 7 segmentos** para datos (BPM, nº de temas, año) → fuente DSEG.
- **Casete girando** como objeto 3D del hero (ver §5).
- Carretes que giran **según el scroll** (como spool de cinta) — guiño perfecto al scroll-driven.
- Etiquetas "Dolby", "TYPE II", "METAL", "60 min" como microcopys.

---

## 4. Tipografía (no común, gratis)

Evitar Google Fonts trilladas. Fuentes gratis y distintivas (Fontshare = calidad, sin licencia de pago):

| Uso | Fuente | Por qué encaja |
|---|---|---|
| Display brutal | **Tanker** (Fontshare) | Ultra-condensada, pesadísima, muy "sports/street" |
| Display alt | **Clash Display** (Fontshare) | Grotesca de carácter, nada común, moderna-retro |
| Titulares | **Khand** / **Excon** (Fontshare) | Condensadas con actitud |
| Quirky | **Panchang**, **Bespoke Stencil** (Fontshare) | Detalle experimental/stencil para el punk |
| Mono técnico (cassette) | **Departure Mono**, **VT323** | Aire de terminal/electrónica antigua |
| LCD 7 segmentos | **DSEG** (dseg font, gratis) | Displays de reloj/Walkman literales |
| Skate display | packs **1001fonts skateboard**, Adobe **Fonts on a Half Pipe** | Estilo grunge/tabla |

Combinación recomendada: **Tanker o Clash Display** (titulares) + **Departure/VT323** (datos/mono) +
**DSEG** (pantallitas LCD). Máximo 2-3 familias para no ensuciar.

---

## 5. El 3D (integrado, coherente con la estética)

Ya tenemos R3F montado (`Backdrop3D.tsx`), así que **reaprovechamos**, pero cambiando el acabado:
- **Objeto protagonista**: un **casete** o un **Walkman** 3D (o una **tabla de skate**), girando lento.
- Acabado **mate/toon** (`meshStandardMaterial` con roughness alta o `MeshToonMaterial` + outline),
  colores planos → **sin degradados ni cromados**. Bajar/quitar el Bloom actual.
- **Scroll-driven**: los **carretes de la cinta giran con el scroll** (metáfora perfecta), o la tabla
  rota/hace un kickflip lento al bajar. (Cuidado con el mareo: movimiento lento, respetar reduce-motion.)
- Alternativa ligera sin WebGL: **CSS 3D** del casete (caras con transforms) — más barato, muy Y2K.

---

## 6. Aterrizaje en ChupitsBeats (qué cambiaría)

- **Quitar los degradados que hay ahora**: los `linear-gradient` de `.g-card`, el glow/Bloom fuerte del
  fondo, y cualquier gradiente en `neo.css`. Sustituir por color plano + sombra dura + trama.
- **Cambiar fuentes**: reemplazar Anton/Bebas/Archivo por Tanker/Clash + mono + DSEG.
- **Barra superior** → estilo Walkman (botones físicos PLAY/REW como navegación).
- **Fondo 3D** → casete/Walkman toon girando; carretes atados al scroll.
- **Galería** de pósters → presentarla como **estantería de cintas / expositor de mixtapes**.
- **Datos** (BPM, temas, año) → **pantallita LCD** de segmentos.
- Los **pósters** editoriales ya casan (halftone, colores planos, tipografía fuerte) → apenas tocar,
  solo alinear paleta y fuentes.

---

## 7. Sitios y recursos de referencia

**Estética Y2K / época:**
- [Web Design Museum — Y2K Aesthetic](https://www.webdesignmuseum.org/exhibitions/y2k-aesthetic-in-web-design)
- [Webflow Blog — Y2K aesthetic](https://webflow.com/blog/y2k-aesthetic)
- [Debuggers Studio — A–Z of Y2K in web design](https://debuggersstudio.com/the-a-z-of-y2k-aesthetic-in-web-design/)

**Cassette futurism / Walkman:**
- [Aesthetics Wiki — Cassette Futurism](https://aesthetics.fandom.com/wiki/Cassette_Futurism)
- [CARI — Cassette Futurism](https://cari.institute/aesthetics/cassette-futurism)
- [Andrew's Universe — UI inspiration: Cassette Futurism](https://andrewsuniverse.com/post/ui-inspiration-cassette-futurism)
- [GitHub — Imetomi/retro-futuristic-ui-design](https://github.com/Imetomi/retro-futuristic-ui-design)
- [SoundManager 2 — Cassette Tape UI (carretes que giran al reproducir)](https://www.schillmania.com/projects/soundmanager2/demo/cassette-tape/more.html)

**Skate / punk / zine:**
- [PRINT Magazine — Punk aesthetic & graphic design](https://www.printmag.com/culturally-related-design/punk-aesthetic-graphic-design/)
- [keboto — Zine culture & DIY punk design](https://keboto.org/zine-culture-diy-publications-influencing-punk-and-indie-graphic-design)
- [Behance — Punk zine projects](https://www.behance.net/search/projects/punk%20zine)

**3D inspiración (interacción/scroll):**
- [Awwwards — Best 3D websites](https://www.awwwards.com/websites/3d/)
- [Awwwards — Three.js](https://www.awwwards.com/websites/three-js/) · [GSAP](https://www.awwwards.com/websites/gsap/)
- [Awwwards — Scroll navigation with animated 3D models](https://www.awwwards.com/inspiration/scroll-navigation-with-animated-3d-models)

**Fuentes:**
- [Fontshare](https://www.fontshare.com/) (Tanker, Clash Display, Khand, Excon, Panchang, Bespoke Stencil)
- [DSEG — 7-segment LCD font](https://www.keshikan.net/fonts-e.html)
- [1001fonts — Skateboard fonts](https://www.1001fonts.com/skateboard-fonts.html)
- [Adobe Fonts — Fonts on a Half Pipe](https://fonts.adobe.com/collections/fonts-on-a-half-pipe)

---

## 8. Riesgos / notas

- **Mareo** (tú ya lo avisaste): el casete/carretes girando con scroll debe ir **lento** y con
  `prefers-reduced-motion`. Nada de rotaciones rápidas ni parallax agresivo.
- **Legibilidad**: la fotocopia/ruido no debe comerse el texto; mantener contraste alto.
- **Coherencia**: elegir **un** pol dominante (skate O cassette) y usar el otro como acento, para no
  hacer un totum revolutum. Recomendación: **cassette/Walkman como esqueleto** (reproductor, LCD, casete 3D)
  + **skate/zine como textura y actitud** (halftone, pegatinas, colores planos).
