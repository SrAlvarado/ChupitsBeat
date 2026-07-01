# Investigación · Webs con animaciones 3D

> Investigación (no implementación). Fecha: 2026-06-30.
> Punto de partida: el artículo de MindStudio sobre webs 3D animadas con Claude Code + IA de vídeo,
> ampliado con el panorama general de técnicas y librerías de webs 3D en 2026.

---

## 1. El artículo de MindStudio

**"Animated 3D Websites with Claude Code + AI Video Generation"**
https://www.mindstudio.ai/blog/animated-3d-websites-claude-code-ai-video-generation

### Idea central
Crear landings animadas de aspecto "high-end" combinando **generación de código (Claude Code)** +
**vídeo generado por IA** (como fondo) + **animaciones al hacer scroll**. Promete resultado
profesional "en una tarde" y por **< 10 $** en costes de API.

### Stack propuesto
- **Claude Code** — genera HTML/CSS/JS.
- **GSAP + ScrollTrigger** — animaciones disparadas por scroll (gratis vía CDN/npm).
- **Generadores de vídeo IA** — Runway Gen-4, Sora, Kling o Hailuo (fondos animados).
- **Three.js** (opcional) — elementos 3D reales (campos de partículas, geometría).
- **HandBrake / FFmpeg** — comprimir/convertir el vídeo.
- **Vercel / Netlify** — hosting estático.

### Flujo de trabajo (pasos)
1. **Generar primero los vídeos** (30-60 min): 3-5 variaciones con prompts concretos (mood, movimiento, color); comprimir a **< 5 MB**.
2. **Andamiaje con Claude Code** (5-15 min): brief claro → estructura de carpetas + imports.
3. **Animaciones de scroll** con GSAP ScrollTrigger: aparición escalonada de tarjetas, secciones "pinned", hover.
4. **Vídeo de fondo**: capa de vídeo + **overlay oscuro** para legibilidad; atributos `autoplay muted loop playsinline`.
5. **Three.js opcional**: partículas/geometría, con **fallback estático en móvil**.
6. **Depurar y desplegar**: ajustar timings, probar móvil, añadir `prefers-reduced-motion`.

### Técnicas y tips clave
- **CSS 3D transforms** (perspective/rotate) para efectos 3D sin framework.
- **Patrón de overlay de vídeo**: `rgba(0,0,20,0.55)` encima del vídeo mejora la lectura del texto.
- **Rendimiento**: `will-change: transform, opacity` en los elementos animados.
- **Accesibilidad**: soporte **obligatorio** de `prefers-reduced-motion`.
- **Los prompts de vídeo importan**: "Slow-moving dark blue and violet fluid geometry, cinematic depth of field" rinde mucho más que descripciones vagas.
- **Coste**: ~2-3 $ tokens Claude + 2-4 $ vídeo + hosting gratis = **5-9 $**.
- Cita destacada: *"CSS 3D combinado con GSAP te da el 80% del impacto visual con el 20% de la complejidad"* → recomienda **moderación** antes que sobre-animar.

### Pros / contras (implícitos)
- **A favor**: prototipado rápido, pocas dependencias, accesibilidad, barato.
- **En contra**: presupuesto de rendimiento en móvil, los timings requieren iteración, Three.js añade complejidad casi nunca necesaria.

---

## 2. Panorama general de webs 3D (2026)

### Estado del arte
- **WebGL 2 es ya la línea base** (Safari lo soporta del todo desde 2022). GPUs de móvil mejores +
  librerías maduras → el 3D en web es **viable en producción**, ya no es una rareza.
- El reto real **no es el 3D, es el rendimiento**: una escena sin optimizar mata a los usuarios de móvil
  y hunde los Core Web Vitals.

### Librerías y herramientas
| Herramienta | Para qué |
|---|---|
| **Three.js** | Abstracción sobre WebGL: escenas, cámaras, luces, materiales, geometría, render loop. Base de casi cualquier escena 3D custom. |
| **React Three Fiber (R3F)** + drei | Three.js de forma declarativa en React (lo que usamos y descartamos en este proyecto). |
| **Spline** | 3D **no-code** para diseñadores; exporta a web. Rápido para escenas sencillas/interactivas. |
| **GSAP + ScrollTrigger** | Animación por timeline; en 3D, mapear scroll → movimiento de cámara, rotación, opacidad. |
| **Lenis** | Smooth-scroll (scroll suave) que casa con ScrollTrigger. |
| **Barba.js** | Transiciones de página manteniendo una escena 3D persistente. |
| **Lottie** | Animaciones vectoriales (After Effects → JSON). |
| **SplitText (GSAP)** | Animar texto carácter/línea. |

### Técnicas habituales
- **Scrollytelling / scroll-driven**: la escena 3D persiste y el scroll dirige cámara/objetos (storytelling).
- **Vídeo de fondo + overlay** (lo del artículo): el "3D" más barato y ligero.
- **CSS 3D transforms**: perspectiva/rotaciones sin WebGL.
- **Campos de partículas / geometría** con Three.js para hero impactante.
- **Transiciones entre páginas** con una escena 3D continua (Webflow + GSAP + Barba).

### Rendimiento y accesibilidad (lo crítico)
- Presupuesto de rendimiento: vigilar Core Web Vitals; **fallback estático en móvil**.
- `prefers-reduced-motion` para quien desactiva animaciones.
- Comprimir assets (vídeo < 5 MB), `will-change`, limitar draw calls/partículas.
- Cargar el 3D **de forma diferida** (lazy) y solo donde aporta.

### ¿Cuándo merece la pena el 3D?
- **Sí**: lanzamientos de producto, portfolios, momentos de marca, hero memorable.
- **No**: blogs, dashboards SaaS, cualquier sitio donde la velocidad importe más que el "feel".

---

## 3. Relevancia para ChupitsBeats
- Ya probamos **R3F (rave subterráneo 3D)** y se **descartó**: no llegaba a un acabado bonito y lageaba
  (ver memoria del proyecto). El artículo confirma el porqué: Three.js full añade mucha complejidad/coste
  de rendimiento para poco retorno si no está muy pulido.
- El enfoque **"vídeo IA de fondo + GSAP/ScrollTrigger + CSS 3D"** sería **mucho más ligero** y encajaría
  en la **landing** (hero con vídeo de fondo neo-psicodélico + animaciones de texto al scroll) **sin** el
  lag que tuvimos, manteniendo el estilo 2D/póster actual.
- Para "wow" puntual sin riesgo: **Spline** (una escena ligera embebida) o partículas R3F muy contenidas,
  siempre con fallback y carga diferida.
- Encaja con tu lista previa: `reactbits.dev/text-animations` (animaciones de texto para la landing) y
  `hano.so` (experiencias 3D) como piezas opcionales del hero.

---

## Fuentes
- [MindStudio — Animated 3D Websites with Claude Code + AI Video](https://www.mindstudio.ai/blog/animated-3d-websites-claude-code-ai-video-generation)
- [Codrops — Seamless 3D Transitions with Webflow, GSAP & Three.js](https://tympanus.net/codrops/2026/03/18/building-seamless-3d-transitions-with-webflow-gsap-and-three-js/)
- [Gridonic — Immersive Web Experiences with GSAP, WebGL & Three.js](https://gridonic.ch/en/blog/creating-immersive-web-experiences-with-gsap-webgl-and-three-js)
- [MDX — Best 3D Websites of 2026](https://mdx.so/blog/best-3d-websites-2026-examples)
- [Mivi — 3D Web Design in 2026: Three.js & Modern Libraries](https://mivibzzz.com/resources/web-development/3d-web-design-threejs-modern-libraries)
- [Digital Strategy Force — The Rise of WebGL-Powered Websites](https://digitalstrategyforce.com/journal/the-rise-of-webgl-powered-websites-how-3d-immersion-is-reshaping-web-development-in-2026/)
- [Medium — Best Claude Code Skills for 3D Websites, Scroll, Three.js, GSAP, Spline](https://new2026.medium.com/best-claude-code-skills-for-3d-websites-scroll-animation-three-js-gsap-and-spline-7f42b28b20c7)
