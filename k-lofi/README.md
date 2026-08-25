# K-LOFI · radio generativa

Recreación de [k-lofi.vercel.app](https://k-lofi.vercel.app) con **Strudel** como
motor de patrones.

## Qué es

Una emisora que no reproduce nada grabado: compone cada tema, lo **escribe como
un programa de Strudel** y lo evalúa en vivo. Detrás, un escenario 3D con
estética PlayStation 1 que cambia con la emisora.

| Emisora | Escenario | Sonido |
|---|---|---|
| **lofi** (60-92 bpm) | la habitación de estudio, de noche y con lluvia | piano eléctrico, swing, cinta gastada |
| **house** (112-132 bpm) | la playa al atardecer, con el mar al ritmo | bombo a negras, contratiempo, stabs |
| **schranz** (140-172 bpm) | el callejón pintado de arriba abajo | bombo a martillo, taladro y ácido |

Claudy, la mascota, flota en los tres.

## Diferencia con el original

El k-lofi de Kevin T. Ngo **no usa Strudel**: es un scheduler propio sobre
WebAudio con voces sintetizadas a mano. Aquí la composición es la misma idea
(progresiones de jazz, cuatro estilos de acompañamiento, etiquetas de ambiente
que empujan los parámetros) pero el resultado se expresa en Strudel — se puede
ver, editar y volver a evaluar desde el panel "Código".

## Arquitectura

| Fichero | Qué hace |
|---|---|
| `src/composer.ts` | Ambientes → perfil → ficha de tema (tonalidad, progresión, motivo, batería) |
| `src/strudelize.ts` | Ficha de tema → programa de Strudel (lo que ves en el panel) |
| `src/radio.ts` | Carga Strudel, evalúa, encadena temas, expone el analizador |
| `src/ambience.ts` | Lluvia y crujido de vinilo en WebAudio puro (texturas continuas, no patrones) |
| `src/composer.ts` → `GENRES` | Rango de tempo, cajas de ritmos y duración de cada emisora |
| `src/scene.ts` | Los tres escenarios: render a 320×180, temblor de vértices, cuantización de color y ojo de pez |
| `src/viz.ts` | Barras de espectro |
| `api/dj.ts` | Claude escribe el próximo tema directamente en Strudel |

## Uso

```bash
npm install
npm run dev
```

Para que funcione el botón **"Que componga Claude"** hace falta el endpoint
serverless, así que en local se levanta con `vercel dev` y una
`ANTHROPIC_API_KEY` en el entorno. Sin él, todo lo demás sigue funcionando: el
compositor local genera los temas.

### Captura automática

```bash
npm run snap          # abre la app, pulsa play, guarda shot.png y vuelca el código
URL=http://localhost:5182/ GENRE=schranz RETUNES=2 npm run snap
```

## Editar el patrón en vivo

Pulsa **Código**, cambia lo que quieras y dale a **Ctrl+Enter**. Es Strudel
normal, así que el ejemplo canónico funciona tal cual:

```js
$: s("[bd <hh oh>]*2").bank("tr909").dec(.4)
```

Cajas de ritmos con alias corto: `tr909`, `tr808`, `tr707`, `linn`, `ace`. Se
cargan también los dirt-samples clásicos, así que `s("bd hh sd")` funciona sin
`.bank()`.

Ojo: no todas las cajas traen los mismos sonidos — `rim` y `cp` no existen en
RhythmAce, y `rim` tampoco en AkaiLinn. `snd()` en `composer.ts` elige el
primero que esa caja tenga de verdad.

## Desplegar en Vercel

El proyecto vive en `k-lofi/`, dentro de un repo que tiene otra app en la raíz,
así que hay que decírselo a Vercel:

| Ajuste | Valor |
|---|---|
| Root Directory | `k-lofi` |
| Framework Preset | Vite (autodetectado) |
| Build Command | `npm run build` (autodetectado) |
| Output Directory | `dist` (autodetectado) |
| Environment Variable | `ANTHROPIC_API_KEY` — sólo para el botón del DJ |

`api/dj.ts` usa el formato Web estándar de Vercel (`export async function POST`),
que el runtime de Node reconoce sin configuración. Un `export default function`
a secas se interpretaría como handler de Node `(req, res)` y `req.json()`
reventaría — de ahí el export por método.

Sin `ANTHROPIC_API_KEY` la emisora funciona igual: el compositor local escribe
los temas y el botón del DJ devuelve un aviso en vez de romper.

## Licencia

Strudel es AGPL-3.0; este proyecto lo usa como dependencia.
