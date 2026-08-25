/**
 * Compositor generativo.
 *
 * Toma las etiquetas de ambiente + los diales y produce una "ficha de tema"
 * (tonalidad, progresión, estilo de acompañamiento, motivo, batería) que
 * después se traduce a código Strudel. El código es el resultado final: la
 * emisora no toca notas, evalúa patrones.
 */

export type Mood =
  | 'lluvia'
  | 'acogedor'
  | 'onírico'
  | 'concentrado'
  | 'somnoliento'
  | 'nostálgico'

export type Style = 'clásico' | 'balada' | 'comping' | 'arpegio'

/** Quién ha firmado el tema, cuando no lo ha hecho el compositor local. */
export type DjAuthor = 'claude' | 'grok' | 'gemini'

/** Las tres emisoras del dial. */
export type Genre = 'lofi' | 'house' | 'schranz'

export interface GenreConfig {
  label: string
  /** rótulo de la emisora en la cabecera */
  station: string
  tempo: { min: number; max: number; def: number; step: number }
  banks: string[]
  bars: { min: number; max: number }
  /** cuánto pesa la ambientación de calle en este género */
  streetLevel: number
}

export const GENRES: Record<Genre, GenreConfig> = {
  lofi: {
    label: 'lofi',
    station: 'callejón · lofi',
    tempo: { min: 60, max: 92, def: 74, step: 1 },
    banks: ['RolandTR808', 'RolandTR707', 'LinnLM1', 'AkaiLinn', 'RhythmAce'],
    bars: { min: 24, max: 40 },
    streetLevel: 1,
  },
  house: {
    label: 'house',
    station: 'sótano · house',
    tempo: { min: 112, max: 132, def: 124, step: 1 },
    banks: ['RolandTR909', 'RolandTR707', 'RolandTR808'],
    bars: { min: 32, max: 64 },
    streetLevel: 0.55,
  },
  schranz: {
    label: 'schranz',
    station: 'nave · schranz',
    tempo: { min: 140, max: 172, def: 152, step: 1 },
    banks: ['RolandTR909', 'RolandTR808'],
    bars: { min: 32, max: 64 },
    streetLevel: 0.25,
  },
}

/**
 * Qué sonidos trae cada caja de ritmos. No todas tienen rim o cp, y pedir uno
 * que no existe deja el patrón mudo, así que se elige con `snd()`.
 */
export const BANK_SOUNDS: Record<string, string[]> = {
  RolandTR808: ['bd', 'cb', 'cp', 'cr', 'hh', 'ht', 'lt', 'mt', 'oh', 'perc', 'rim', 'sd', 'sh'],
  RolandTR909: ['bd', 'cp', 'cr', 'hh', 'ht', 'lt', 'mt', 'oh', 'rd', 'rim', 'sd'],
  RolandTR707: ['bd', 'cb', 'cp', 'cr', 'hh', 'ht', 'lt', 'mt', 'oh', 'rim', 'sd', 'tb'],
  LinnLM1: ['bd', 'cb', 'cp', 'hh', 'ht', 'lt', 'oh', 'perc', 'rim', 'sd', 'sh', 'tb'],
  AkaiLinn: ['bd', 'cb', 'cp', 'cr', 'hh', 'ht', 'lt', 'mt', 'oh', 'rd', 'sd', 'sh', 'tb'],
  RhythmAce: ['bd', 'hh', 'ht', 'lt', 'oh', 'perc', 'sd'],
}

/** El primer sonido de la lista que esa caja tenga de verdad. */
export function snd(bank: string, ...prefs: string[]): string {
  const list = BANK_SOUNDS[bank] ?? ['bd', 'sd', 'hh', 'oh']
  return prefs.find((p) => list.includes(p)) ?? 'sd'
}

export interface Vibe {
  genre: Genre
  moods: Mood[]
  tempo: number
  tapeWear: number // 0..100
  rain: number // 0..100
}

export interface MoodProfile {
  melodyDensity: number
  brightness: number // desplazamiento del corte en Hz
  echo: number
  reverb: number
  drumEnergy: number
  minorBias: number
  styleWeights: Record<Style, number>
}

export interface MotifStep {
  deg: number
  oct: number
  rest: boolean
}

export interface Song {
  title: string
  genre: Genre
  style: Style
  keyRoot: number // midi
  minor: boolean
  prog: Array<[number, ChordQuality]>
  pent: number[]
  kicks: number[]
  motif: MotifStep[]
  hatDensity: number
  bars: number
  bank: string
  by?: DjAuthor
  djLine?: string
}

export type ChordQuality = 'm7' | 'm9' | 'maj7' | 'maj9' | '7' | '9'

/** Intervalos de cada cualidad, en semitonos sobre la fundamental. */
export const CHORDS: Record<ChordQuality, number[]> = {
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  7: [0, 4, 7, 10],
  9: [0, 4, 7, 10, 14],
}

/** Progresiones en modo menor (grado en semitonos desde la tónica). */
const MINOR_PROGS: Array<Array<[number, ChordQuality]>> = [
  [[0, 'm9'], [5, 'm7'], [10, '7'], [3, 'maj7']],
  [[0, 'm7'], [8, 'maj7'], [10, '7'], [0, 'm9']],
  [[0, 'm9'], [3, 'maj7'], [8, 'maj9'], [7, '7']],
  [[0, 'm7'], [5, 'm9'], [3, 'maj7'], [10, '9']],
]

/** Progresiones en modo mayor. */
const MAJOR_PROGS: Array<Array<[number, ChordQuality]>> = [
  [[2, 'm7'], [7, '9'], [0, 'maj9'], [9, 'm7']],
  [[0, 'maj7'], [9, 'm7'], [2, 'm9'], [7, '7']],
  [[0, 'maj9'], [4, 'm7'], [5, 'maj7'], [7, '9']],
]

const PENT_MINOR = [0, 3, 5, 7, 10]
const PENT_MAJOR = [0, 2, 4, 7, 9]

/** Patrones de bombo, como índices de semicorchea dentro del compás. */
const KICK_PATTERNS = [
  [0, 10],
  [0, 7, 10],
  [0, 6, 10, 13],
  [0, 10, 11],
]

export const rnd = (min: number, max: number) => min + Math.random() * (max - min)
export const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function weightedPick(weights: Record<Style, number>): Style {
  const entries = Object.entries(weights) as Array<[Style, number]>
  const total = entries.reduce((sum, [, w]) => sum + Math.max(0.02, w), 0)
  let r = Math.random() * total
  for (const [style, w] of entries) {
    r -= Math.max(0.02, w)
    if (r <= 0) return style
  }
  return 'clásico'
}

/** Cada etiqueta de ambiente empuja los parámetros del motor en una dirección. */
export function moodProfile(moods: Mood[]): MoodProfile {
  const p: MoodProfile = {
    melodyDensity: 0.42,
    brightness: 0,
    echo: 0.06,
    reverb: 0.22,
    drumEnergy: 1,
    minorBias: 0,
    styleWeights: { clásico: 0.35, balada: 0.2, comping: 0.25, arpegio: 0.2 },
  }
  const w = p.styleWeights
  for (const mood of moods) {
    switch (mood) {
      case 'lluvia':
        p.minorBias += 0.2; p.reverb += 0.05; w.balada += 0.08; w.arpegio += 0.05
        break
      case 'acogedor':
        p.brightness -= 350; p.melodyDensity -= 0.05; w.balada += 0.1
        break
      case 'onírico':
        p.echo += 0.22; p.reverb += 0.12; p.minorBias -= 0.25
        p.brightness += 150; w.arpegio += 0.3
        break
      case 'concentrado':
        p.melodyDensity -= 0.18; p.drumEnergy += 0.1; p.brightness += 200
        w.clásico += 0.2; w.comping += 0.1; w.balada -= 0.15
        break
      case 'somnoliento':
        p.melodyDensity -= 0.22; p.drumEnergy -= 0.25; p.brightness -= 450
        w.balada += 0.25; w.comping -= 0.15
        break
      case 'nostálgico':
        p.minorBias += 0.25; p.echo += 0.1; w.clásico += 0.12
        break
    }
  }
  return p
}

const WORDS: Record<Genre, { adj: string[]; noun: string[] }> = {
  lofi: {
    adj: ['tinta', 'ceniza', 'lluvia', 'neón', 'vapor', 'polvo', 'ámbar', 'niebla', 'cinta', 'cristal'],
    noun: ['de martes', 'a las 3am', 'en el 4º', 'de vuelta', 'sin prisa', 'en bucle', 'de invierno', 'apagado', 'de nadie'],
  },
  house: {
    adj: ['sótano', 'espray', 'cromo', 'látex', 'humo', 'acero', 'sudor', 'láser', 'cinta', 'clave'],
    noun: ['a las 5am', 'sin salida', 'en el after', 'del portal', 'de la nave', 'en obras', 'de contrabando', 'sin permiso'],
  },
  schranz: {
    adj: ['chapa', 'óxido', 'taladro', 'cemento', 'grapa', 'chatarra', 'ácido', 'muro', 'clavo', 'brasa'],
    noun: ['contra el muro', 'a martillo', 'sin freno', 'del polígono', 'a 160', 'en rojo', 'sin salida', 'de derribo'],
  },
}

export function makeTitle(genre: Genre = 'lofi'): string {
  const w = WORDS[genre]
  return `${pick(w.adj)} ${pick(w.noun)}`
}

export function makeSong(p: MoodProfile, genre: Genre = 'lofi'): Song {
  const cfg = GENRES[genre]
  // house y schranz viven en menor casi siempre; el lofi se deja llevar
  const minorFloor = genre === 'lofi' ? 0 : 0.55
  const minor = Math.random() < clamp(0.55 + p.minorBias + minorFloor, 0.1, 0.98)
  const motif: MotifStep[] = []
  for (let i = 0; i < 8; i++) {
    motif.push({
      deg: Math.floor(rnd(0, 5)),
      oct: Math.random() < 0.25 ? 1 : 0,
      rest: Math.random() < 0.42,
    })
  }
  const barSpan = cfg.bars.max - cfg.bars.min
  return {
    title: makeTitle(genre),
    genre,
    style: weightedPick(p.styleWeights),
    keyRoot: 45 + Math.floor(rnd(0, 7)),
    minor,
    prog: pick(minor ? MINOR_PROGS : MAJOR_PROGS),
    pent: minor ? PENT_MINOR : PENT_MAJOR,
    kicks: genre === 'lofi' ? pick(KICK_PATTERNS) : [0, 4, 8, 12],
    motif,
    hatDensity: rnd(0.65, 1),
    bars: cfg.bars.min + 8 * Math.floor(rnd(0, barSpan / 8 + 1)),
    bank: pick(cfg.banks),
  }
}

/* ── traducción a notas ──────────────────────────────────────────────── */

const NAMES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b']

/** midi → nombre de nota de Strudel, p. ej. 60 → "c5" (c5 = midi 60). */
export function noteName(midi: number): string {
  const m = Math.round(midi)
  return `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`
}

/** Pliega una nota dentro de un rango, saltando octavas. */
export function fold(midi: number, lo: number, hi: number): number {
  let n = midi
  while (n < lo) n += 12
  while (n > hi) n -= 12
  return n
}

/** Voicing sin fundamental (la lleva el bajo), plegado al registro medio. */
export function voice(root: number, quality: ChordQuality, lo = 58, hi = 76): number[] {
  const set = new Set<number>()
  for (const iv of CHORDS[quality].slice(1)) set.add(fold(root + iv, lo, hi))
  if (Math.random() < 0.5) set.add(fold(root + 12, lo, hi))
  return [...set].sort((a, b) => a - b)
}

export const KEY_NAMES = NAMES
