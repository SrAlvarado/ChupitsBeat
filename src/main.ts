/** Cableado: consola ↔ emisora Strudel ↔ escena 3D. */
import './style.css'
import { Radio, type DjBrief, type TrackInfo } from './radio'
import { mountScene } from './scene'
import { energyOf, mountViz } from './viz'
import { GENRES, type Genre, type Mood, type Vibe } from './composer'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const stage = $('stage')
const playBtn = $<HTMLButtonElement>('play')
const retuneBtn = $<HTMLButtonElement>('retune')
const nowPlaying = $('now-playing')
const djBtn = $<HTMLButtonElement>('dj-compose')
const djLine = $('dj-line')
const codeArea = $<HTMLTextAreaElement>('code')
const codePanel = $('code-panel')
const codeToggle = $<HTMLButtonElement>('code-toggle')
const codeRun = $<HTMLButtonElement>('code-run')
const consoleEl = $('console')
const consoleBody = $('console-body')
const consoleToggle = $<HTMLButtonElement>('console-toggle')
const shell = $('shell')
const flash = $('flash')
const genreBtns = [...document.querySelectorAll<HTMLButtonElement>('.genre')]

/* ── estado de la consola ────────────────────────────────────────────── */
const vibe: Vibe = { genre: 'lofi', moods: ['lluvia', 'acogedor'], tempo: 74, tapeWear: 45, rain: 30 }

const chips = [...document.querySelectorAll<HTMLButtonElement>('.chip')]
const readMoods = (): Mood[] =>
  chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.mood as Mood)

const dials = [
  { input: $<HTMLInputElement>('dial-tempo'), out: $('out-tempo'), key: 'tempo', fmt: (v: number) => `${v} bpm` },
  { input: $<HTMLInputElement>('dial-tape'), out: $('out-tape'), key: 'tapeWear', fmt: (v: number) => `${v}%` },
  { input: $<HTMLInputElement>('dial-rain'), out: $('out-rain'), key: 'rain', fmt: (v: number) => `${v}%` },
] as const

/* ── emisora ─────────────────────────────────────────────────────────── */
const radio = new Radio()

radio.onCode = (code) => {
  // no pisamos lo que esté escribiendo el oyente
  if (document.activeElement !== codeArea) codeArea.value = code
}
radio.onStatus = (msg) => {
  djLine.textContent = msg
}
radio.onTrack = (info: TrackInfo) => {
  const dj = info.by ? ` · <span class="claude-tag">✳ ${info.by} a los platos</span>` : ''
  const style = info.genre === 'lofi' ? ` · ${info.style}` : ''
  nowPlaying.innerHTML =
    `suena: <span class="track"></span> · ${info.genre} · ${info.tempo} bpm${style}${dj}`
  nowPlaying.querySelector('.track')!.textContent = `「${info.title}」`
  djLine.textContent = info.djLine ?? ''
  popFlash()
}

/** Flash de cámara: cada tema nuevo entra como una foto con flash. */
const popFlash = () => {
  flash.classList.remove('pop')
  void flash.offsetWidth // fuerza el reinicio de la animación
  flash.classList.add('pop')
}

const setPlayingUI = (playing: boolean) => {
  playBtn.setAttribute('aria-pressed', String(playing))
  playBtn.innerHTML = playing
    ? '<span class="ico" aria-hidden="true">⏸</span> Pausa'
    : '<span class="ico" aria-hidden="true">▶</span> Play'
  document.body.classList.toggle('on-air', playing)
  if (!playing) nowPlaying.textContent = 'en pausa — pulsa play'
}

playBtn.addEventListener('click', () => {
  playBtn.disabled = true
  nowPlaying.textContent = 'sintonizando…'
  void radio
    .toggle(vibe)
    .then(setPlayingUI)
    .catch((err: unknown) => {
      nowPlaying.textContent = `no arranca — ${err instanceof Error ? err.message : String(err)}`
    })
    .finally(() => {
      playBtn.disabled = false
    })
})

retuneBtn.addEventListener('click', () => {
  radio.setVibe(vibe)
  if (radio.playing) void radio.compose()
  else nowPlaying.textContent = 'fuera de antena — pulsa play'
})

/** Cambiar de emisora reencuadra el dial de tempo y repinta la consola. */
const applyGenre = (genre: Genre, recompose: boolean) => {
  vibe.genre = genre
  const cfg = GENRES[genre]
  for (const btn of genreBtns) {
    btn.setAttribute('aria-pressed', String(btn.dataset.genre === genre))
  }
  document.body.dataset.genre = genre

  const tempo = dials[0].input
  tempo.min = String(cfg.tempo.min)
  tempo.max = String(cfg.tempo.max)
  tempo.step = String(cfg.tempo.step)
  tempo.value = String(cfg.tempo.def)
  vibe.tempo = cfg.tempo.def
  dials[0].out.textContent = dials[0].fmt(cfg.tempo.def)

  radio.setVibe(vibe)
  if (recompose && radio.playing) void radio.compose()
}

for (const btn of genreBtns) {
  btn.addEventListener('click', () => applyGenre(btn.dataset.genre as Genre, true))
}

for (const chip of chips) {
  chip.addEventListener('click', () => {
    const on = chip.getAttribute('aria-pressed') === 'true'
    chip.setAttribute('aria-pressed', String(!on))
    vibe.moods = readMoods()
    radio.setVibe(vibe)
  })
}

for (const dial of dials) {
  dial.input.addEventListener('input', () => {
    const v = Number(dial.input.value)
    ;(vibe as unknown as Record<string, number>)[dial.key] = v
    dial.out.textContent = dial.fmt(v)
    radio.setVibe(vibe)
  })
}

/* ── panel de código ─────────────────────────────────────────────────── */
const setCodeOpen = (open: boolean) => {
  codePanel.hidden = !open
  codeToggle.setAttribute('aria-expanded', String(open))
}
codeToggle.addEventListener('click', () => setCodeOpen(codePanel.hidden))

const runEdited = () => {
  if (!radio.playing) {
    djLine.textContent = 'pulsa play antes de evaluar'
    return
  }
  void radio.run(codeArea.value)
}
codeRun.addEventListener('click', runEdited)
codeArea.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    runEdited()
  }
})

/* ── plegar la consola sobre la escena ───────────────────────────────── */
const COLLAPSE_KEY = 'chupitbeats-console-collapsed'
const setCollapsed = (collapsed: boolean) => {
  shell.classList.toggle('collapsed', collapsed)
  consoleEl.classList.toggle('collapsed', collapsed)
  consoleBody.hidden = collapsed
  consoleToggle.setAttribute('aria-expanded', String(!collapsed))
  consoleToggle.innerHTML = collapsed
    ? '<span class="ico" aria-hidden="true">▴</span> Controles'
    : '<span class="ico" aria-hidden="true">▾</span> Ocultar'
  try {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  } catch {
    /* modo privado: da igual */
  }
}
consoleToggle.addEventListener('click', () => setCollapsed(!consoleEl.classList.contains('collapsed')))
try {
  if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true)
} catch {
  /* ignorado */
}

/* ── DJ ──────────────────────────────────────────────────────────────── */
djBtn.addEventListener('click', () => {
  void (async () => {
    djBtn.disabled = true
    djLine.textContent = 'la IA está escribiendo el patrón…'
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 30000)
    try {
      const res = await fetch('/api/dj', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vibe }),
      })
      const data = (await res.json().catch(() => ({}))) as DjBrief & { error?: string }
      if (!res.ok || data.error) {
        throw new Error(
          data.error ??
            (res.status === 404
              ? 'no encuentro /api/dj (el despliegue debe incluir la carpeta api/)'
              : `se cortó la línea del DJ (${res.status})`),
        )
      }
      radio.setVibe(vibe)
      await radio.compose(data)
    } catch (err) {
      djLine.textContent =
        err instanceof Error ? err.message : 'el DJ no coge el teléfono — prueba otra vez'
    } finally {
      clearTimeout(timeout)
      djBtn.disabled = false
    }
  })()
})

/* ── arranque ────────────────────────────────────────────────────────── */
applyGenre('lofi', false)

/* ── escena y visualizador ───────────────────────────────────────────── */
const scene = mountScene(stage)
mountViz($<HTMLCanvasElement>('viz'), () => radio.spectrum())

const pump = () => {
  requestAnimationFrame(pump)
  scene.update(energyOf(radio.spectrum()), vibe.rain, radio.playing, vibe.genre)
}
pump()
