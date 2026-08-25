/**
 * La emisora.
 *
 * Strudel es el motor: cada tema es un programa que se genera, se muestra en
 * el panel de código y se evalúa. El paso de un tema al siguiente lo lleva
 * esta clase (silencio breve entre cortes, como una emisora de verdad).
 */
import {
  initStrudel,
  initAudio,
  evaluate,
  hush,
  getAudioContext,
  getAnalyzerData,
  aliasBank,
  samples,
} from '@strudel/web'
import { Ambience } from './ambience'
import {
  makeSong,
  moodProfile,
  makeTitle,
  clamp,
  GENRES,
  type DjAuthor,
  type Genre,
  type Song,
  type Vibe,
  type Style,
} from './composer'
import { strudelize } from './strudelize'

const DRUM_MACHINES =
  'https://raw.githubusercontent.com/felixroos/dough-samples/main/tidal-drum-machines.json'
/** El set clásico de Tidal: hace que s("bd hh sd") funcione sin .bank(). */
const DIRT = 'github:tidalcycles/dirt-samples'

export interface TrackInfo {
  title: string
  genre: Genre
  style: Style
  bars: number
  tempo: number
  by: DjAuthor | null
  djLine?: string
}

/** Lo que puede mandar el DJ para tomar el control del próximo tema. */
export interface DjBrief {
  title?: string
  line?: string
  code?: string
  by?: DjAuthor
  style?: Style
  minor?: boolean
  bars?: number
  hatDensity?: number
  bank?: string
}

export class Radio {
  onTrack: ((info: TrackInfo) => void) | null = null
  onCode: ((code: string) => void) | null = null
  onStatus: ((msg: string) => void) | null = null

  private ready: Promise<unknown> | null = null
  private ambience: Ambience | null = null
  private vibe: Vibe = { genre: 'lofi', moods: ['lluvia', 'acogedor'], tempo: 74, tapeWear: 45, rain: 30 }
  private song: Song = makeSong(moodProfile(['lluvia', 'acogedor']), 'lofi')
  private code = ''
  private timer: number | null = null
  private analyserBuf: Float32Array | null = null
  playing = false

  get currentCode() {
    return this.code
  }

  get currentVibe(): Vibe {
    return { ...this.vibe, moods: [...this.vibe.moods] }
  }

  /** Carga Strudel y las cajas de ritmos. Sólo la primera vez. */
  private init() {
    if (this.ready) return this.ready
    this.ready = (async () => {
      await initStrudel({ prebake: () => Promise.all([samples(DRUM_MACHINES), samples(DIRT)]) })
      // sin esto los worklets de superdough no existen y .coarse()/.vib() fallan
      await initAudio()
      // el ejemplo canónico de Strudel usa nombres cortos de caja
      aliasBank({
        tr909: 'RolandTR909',
        tr808: 'RolandTR808',
        tr707: 'RolandTR707',
        linn: 'LinnLM1',
        ace: 'RhythmAce',
      })
      this.ambience = new Ambience(getAudioContext())
      this.ambience.start()
      this.pushAmbience()
    })()
    return this.ready
  }

  async toggle(vibe: Vibe): Promise<boolean> {
    this.vibe = { ...vibe, moods: [...vibe.moods] }
    await this.init()
    if (this.playing) {
      this.stopTimer()
      hush()
      this.ambience?.mute(true)
      this.playing = false
      return false
    }
    this.playing = true
    this.ambience?.mute(false)
    await this.compose()
    return true
  }

  /** Aplica diales sin cortar el tema (sólo la ambientación es instantánea). */
  setVibe(vibe: Vibe) {
    this.vibe = { ...vibe, moods: [...vibe.moods] }
    this.pushAmbience()
  }

  /** La calle suena menos según bajamos al sótano y a la nave. */
  private pushAmbience() {
    const level = GENRES[this.vibe.genre].streetLevel
    this.ambience?.set(this.vibe.rain * level, this.vibe.tapeWear)
  }

  /** Compone y pincha un tema nuevo. `brief` deja que el DJ mande. */
  async compose(brief?: DjBrief) {
    await this.init()
    const profile = moodProfile(this.vibe.moods)
    const song = makeSong(profile, this.vibe.genre)
    if (brief) {
      if (brief.style) song.style = brief.style
      if (brief.minor !== undefined) song.minor = brief.minor
      if (brief.bars !== undefined) song.bars = clamp(Math.round(brief.bars), 16, 48)
      if (brief.hatDensity !== undefined) song.hatDensity = clamp(brief.hatDensity, 0.2, 1)
      if (brief.bank) song.bank = brief.bank
      song.title = brief.title ?? makeTitle(this.vibe.genre)
      song.djLine = brief.line
      song.by = brief.by ?? 'claude'
    }
    this.song = song
    const code = brief?.code?.trim() ? brief.code : strudelize(song, this.vibe, profile)
    await this.run(code)
  }

  /** Evalúa código (generado o editado a mano) y programa el fin del tema. */
  async run(code: string) {
    await this.init()
    this.code = code
    this.onCode?.(code)
    if (!this.playing) return
    try {
      await evaluate(code)
    } catch (err) {
      this.onStatus?.(
        `el patrón no compila — ${err instanceof Error ? err.message : String(err)}`,
      )
      return
    }
    this.onTrack?.({
      title: this.song.title,
      genre: this.song.genre,
      style: this.song.style,
      bars: this.song.bars,
      tempo: this.vibe.tempo,
      by: this.song.by ?? null,
      djLine: this.song.djLine,
    })
    this.scheduleNext()
  }

  /** Un compás dura 4 negras; el tema dura `bars` compases + un respiro. */
  private scheduleNext() {
    this.stopTimer()
    const barSeconds = (60 / this.vibe.tempo) * 4
    const trackMs = this.song.bars * barSeconds * 1000
    this.timer = window.setTimeout(() => {
      if (!this.playing) return
      hush()
      this.onStatus?.('cambiando de cara…')
      this.timer = window.setTimeout(() => {
        if (this.playing) void this.compose()
      }, 2200)
    }, trackMs)
  }

  private stopTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /** Energía 0..1 del espectro, para mover la escena 3D y el visualizador. */
  spectrum(): Float32Array | null {
    if (!this.playing) return null
    try {
      const data = getAnalyzerData('frequency', 1) as Float32Array
      this.analyserBuf = data
      return data
    } catch {
      return this.analyserBuf
    }
  }
}
