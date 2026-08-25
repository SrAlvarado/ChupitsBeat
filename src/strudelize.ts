/**
 * Traductor: ficha de tema → código Strudel.
 *
 * Tres emisoras, tres formas de escribir el mismo material armónico:
 *   · lofi     — piano eléctrico, swing, cinta gastada
 *   · house    — bombo a negras, hats a contratiempo, stabs y bajo rodante
 *   · schranz  — bombo distorsionado, percusión de taladro y línea ácida
 *
 * Lo que sale de aquí es exactamente lo que se evalúa y lo que se ve en el
 * panel "Código". Si lo editas a mano y pulsas Ctrl+Enter, manda tu versión.
 */
import {
  CHORDS,
  clamp,
  fold,
  noteName,
  pick,
  rnd,
  snd,
  voice,
  type DjAuthor,
  type Genre,
  type Song,
  type Style,
  type MoodProfile,
  type Vibe,
} from './composer'

/** Rejilla de 16 semicorcheas a mini-notación: [3,7] → "~ ~ ~ x ~ ~ ~ x ..." */
function grid(hits: number[], symbol = 'x'): string {
  const cells = Array.from({ length: 16 }, () => '~')
  for (const h of hits) cells[Math.floor(h) % 16] = symbol
  return cells
    .reduce<string[]>((acc, c, i) => {
      if (i % 4 === 0) acc.push('')
      acc[acc.length - 1] += (acc[acc.length - 1] ? ' ' : '') + c
      return acc
    }, [])
    .join('  ')
}

const CHORD_STRUCT: Record<Style, string> = {
  'clásico': grid([0, 10]),
  'balada': grid([0, 8]),
  'comping': grid([0, 6, 10]),
  'arpegio': grid([0]),
}

/** La secuencia de acordes del tema, un voicing por compás: "<[..] [..]>". */
function chordSeq(song: Song, lo = 58, hi = 76): string {
  return `<${song.prog
    .map(([deg, quality]) => `[${voice(song.keyRoot + deg, quality, lo, hi).map(noteName).join(',')}]`)
    .join(' ')}>`
}

/** Fundamental del bajo por compás, plegada al registro grave. */
function bassSeq(song: Song, lo = 38, hi = 50): string {
  return `<${song.prog.map(([deg]) => noteName(fold(song.keyRoot + deg, lo, hi))).join(' ')}>`
}

/** Motivo de 8 corcheas sobre la pentatónica, con silencios. */
function motifSeq(song: Song, octave = 24, lo = 64, hi = 82): string {
  return song.motif
    .map((step) =>
      step.rest
        ? '~'
        : noteName(fold(song.keyRoot + song.pent[step.deg] + octave + step.oct * 12, lo, hi)),
    )
    .join(' ')
}

/** Nombre legible de la tonalidad, para el comentario de cabecera. */
export function keyLabel(song: Song): string {
  const name = noteName(song.keyRoot).replace(/\d+$/, '').toUpperCase()
  return `${name} ${song.minor ? 'menor' : 'mayor'}`
}

interface Opts {
  lpf: number
  wow: number
  coarse: number
  crush: number
  reverb: number
  echo: number
  delayTime: number
  /** el dial de cinta como 0..1, que en house/schranz es "suciedad" */
  dirt: number
}

function opts(vibe: Vibe, p: MoodProfile): Opts {
  const w = vibe.tapeWear / 100
  return {
    lpf: Math.round(clamp(3400 - w * 1300 + p.brightness, 900, 5200)),
    wow: Number((0.01 + w * 0.06).toFixed(3)),
    coarse: Math.max(1, Math.round(1 + w * 3)),
    crush: Number((16 - w * 6).toFixed(1)),
    reverb: Number(clamp(p.reverb, 0.05, 0.6).toFixed(2)),
    echo: Number(clamp(p.echo, 0, 0.5).toFixed(2)),
    delayTime: Number((0.75 * (60 / vibe.tempo)).toFixed(3)),
    dirt: w,
  }
}

/* ══ LOFI ══════════════════════════════════════════════════════════════ */

function lofiChords(song: Song, o: Opts): string {
  const base = `note("${chordSeq(song)}")`
  if (song.style === 'arpegio') {
    return `$: ${base}
  .arp("<[0 1 2 3 2 1 2 3]*2 [0 2 3 2 1 2 3 1]*2 [0 1 2 3 3 2 1 0]*2>")
  .sound("triangle")
  .attack(.008).decay(.22).sustain(.05).release(.4)
  .lpf(${o.lpf}).lpq(2)
  .vib(.4).vibmod(${o.wow.toFixed(3)})
  .room(${o.reverb.toFixed(2)}).roomsize(2.6)
  .delay(${o.echo.toFixed(2)}).delaytime(${o.delayTime.toFixed(3)}).delayfeedback(.32)
  .gain(.42).pan(.46)
  .analyze(1)`
  }
  const sustain = song.style === 'balada' ? 0.5 : 0.22
  const release = song.style === 'balada' ? 1.4 : 0.7
  return `$: ${base}
  .struct("${CHORD_STRUCT[song.style]}")
  .sound("sine")
  .attack(.012).decay(.34).sustain(${sustain}).release(${release})
  .lpf(${o.lpf}).lpq(1.6)
  .vib(.4).vibmod(${o.wow.toFixed(3)})
  .room(${o.reverb.toFixed(2)}).roomsize(2.6)
  .gain(.48).pan(.44)
  .analyze(1)`
}

function lofiBass(song: Song, o: Opts): string {
  const struct = song.style === 'balada' ? grid([0]) : grid([0, 8])
  return `$: note("${bassSeq(song)}")
  .struct("${struct}")
  .sound("sine")
  .attack(.02).decay(.5).sustain(.35).release(.5)
  .lpf(520)
  .vib(.32).vibmod(${(o.wow * 0.6).toFixed(3)})
  .gain(.62)
  .analyze(1)`
}

function lofiLead(song: Song, o: Opts, p: MoodProfile): string {
  let density = p.melodyDensity
  if (song.style === 'balada') density *= 0.6
  if (song.style === 'arpegio') density *= 0.4
  const drop = clamp(1 - density, 0.05, 0.9)
  return `$: note("${motifSeq(song)}")
  .sound("triangle")
  .degradeBy(${drop.toFixed(2)})
  .sometimesBy(.18, x => x.add(12))
  .attack(.03).decay(.3).sustain(.15).release(.5)
  .lpf(${Math.round(o.lpf * 1.2)})
  .vib(4.3).vibmod(.08)
  .room(${(o.reverb * 1.2).toFixed(2)}).roomsize(3)
  .delay(${(o.echo * 1.6).toFixed(2)}).delaytime(${o.delayTime.toFixed(3)}).delayfeedback(.34)
  .gain(.3).pan(.56)
  .analyze(1)`
}

function lofiDrums(song: Song, o: Opts, p: MoodProfile): string {
  const energy = clamp(p.drumEnergy, 0.4, 1.3)
  let kicks = song.kicks
  let snares = [4, 12]
  let snareSound = 'sd'
  let hatMult = 1
  switch (song.style) {
    case 'balada':
      kicks = [0, 8]; snares = [12]; snareSound = snd(song.bank, 'rim', 'sd'); hatMult = 0.45
      break
    case 'comping':
      hatMult = 1.1
      break
    case 'arpegio':
      kicks = [0, 10]; hatMult = 0.8
      break
  }
  const hatDrop = clamp(1 - song.hatDensity * hatMult, 0.05, 0.85)
  return `$: stack(
  s("${grid(kicks, 'bd')}").gain(${(0.9 * energy).toFixed(2)}),
  s("${grid(snares, snareSound)}").gain(${(0.55 * energy).toFixed(2)}).late(.012),
  s("hh*8").gain("${(0.3 * energy).toFixed(2)} ${(0.19 * energy).toFixed(2)}").degradeBy(${hatDrop.toFixed(2)}),
  s("~ ~ ~ ~ ~ ~ ~ <~ oh>").gain(${(0.18 * energy).toFixed(2)})
).bank("${song.bank}")
  .lpf(${Math.round(o.lpf * 1.35)})
  .coarse(${o.coarse})
  .swingBy(1/24, 4)
  .room(.12)
  .gain(.9)
  .analyze(1)`
}

/* ══ HOUSE ═════════════════════════════════════════════════════════════ */

function houseDrums(song: Song, o: Opts, p: MoodProfile): string {
  const energy = clamp(p.drumEnergy, 0.6, 1.3)
  const clap = Math.random() < 0.4 ? snd(song.bank, 'cp', 'sd') : 'sd'
  const clapPat = grid([4, 12], clap)
  const tick = snd(song.bank, 'rim', 'cb', 'hh')
  const rideDrop = clamp(1 - song.hatDensity, 0.05, 0.6)
  return `$: stack(
  // bombo a negras: la ley del sótano
  s("bd*4").gain(${(1.0 * energy).toFixed(2)}).shape(${(0.12 + o.dirt * 0.2).toFixed(2)}),
  s("${clapPat}").gain(${(0.6 * energy).toFixed(2)}).room(.22),
  // charles a contratiempo
  s("~ oh").fast(4).gain(${(0.4 * energy).toFixed(2)}).dec(.06),
  s("hh*16").gain("${(0.2 * energy).toFixed(2)} ${(0.11 * energy).toFixed(2)}").degradeBy(${rideDrop.toFixed(2)}),
  s("~ ~ ~ ${tick} ~ ~ <~ ${tick}> ~").gain(${(0.3 * energy).toFixed(2)})
).bank("${song.bank}")
  .lpf(${Math.round(clamp(o.lpf * 2.2, 3000, 14000))})
  .swingBy(1/32, 8)
  .gain(.95)
  .analyze(1)`
}

function houseBass(song: Song, o: Opts): string {
  const seq = bassSeq(song, 33, 45)
  return `$: note("${seq}")
  .struct("x ~ x x  ~ x ~ x  x ~ x x  ~ x ~ ~")
  .sound("sawtooth")
  .attack(.005).decay(.14).sustain(0).release(.08)
  .lpf(${Math.round(clamp(320 + o.lpf * 0.12, 300, 900))}).lpq(6)
  .shape(${(0.15 + o.dirt * 0.25).toFixed(2)})
  .gain(.7)
  .analyze(1)`
}

function houseStabs(song: Song, o: Opts): string {
  const seq = chordSeq(song, 60, 79)
  return `$: note("${seq}")
  .struct("~ ~ x ~  ~ ~ ~ x  ~ ~ x ~  ~ x ~ ~")
  .sound("sawtooth")
  .attack(.004).decay(.16).sustain(0).release(.12)
  .lpf(sine.range(700, ${Math.round(clamp(2200 + o.lpf, 2400, 6000))}).slow(16)).lpq(9)
  .room(${(o.reverb * 1.1).toFixed(2)}).roomsize(2)
  .delay(${(0.12 + o.echo).toFixed(2)}).delaytime(${(o.delayTime * 0.5).toFixed(3)}).delayfeedback(.3)
  .gain(.4).pan(sine.range(.35, .65).slow(9))
  .analyze(1)`
}

function houseLead(song: Song, o: Opts, p: MoodProfile): string {
  const drop = clamp(1 - p.melodyDensity * 0.8, 0.15, 0.85)
  return `$: note("${motifSeq(song, 12, 55, 74)}")
  .fast(2)
  .degradeBy(${drop.toFixed(2)})
  .sometimesBy(.2, x => x.add(12))
  .sound("square")
  .attack(.004).decay(.12).sustain(0).release(.1)
  .lpf(${Math.round(clamp(o.lpf * 1.6, 1400, 6000))}).lpq(7)
  .room(${(o.reverb * 1.3).toFixed(2)})
  .delay(${(0.2 + o.echo).toFixed(2)}).delaytime(${(o.delayTime * 0.667).toFixed(3)}).delayfeedback(.42)
  .gain(.26).pan(.58)
  .analyze(1)`
}

/* ══ SCHRANZ ═══════════════════════════════════════════════════════════ */

function schranzKick(o: Opts, p: MoodProfile): string {
  const energy = clamp(p.drumEnergy, 0.7, 1.3)
  return `$: s("bd*4").bank("RolandTR909")
  .dec(.28)
  .shape(${(0.55 + o.dirt * 0.3).toFixed(2)})
  .crush(${(8 - o.dirt * 3).toFixed(1)})
  .lpf(sine.range(2200, 7000).slow(32))
  .gain(${(1.15 * energy).toFixed(2)})
  .analyze(1)`
}

function schranzPerc(song: Song, o: Opts, p: MoodProfile): string {
  const energy = clamp(p.drumEnergy, 0.7, 1.3)
  const clap = snd(song.bank, 'cp', 'sd')
  const roll = pick(['hh*16', 'hh*8 hh*16', '[hh*16]!3 hh*32', 'hh*12'])
  return `$: stack(
  // percusión rodante: el taladro
  s("${roll}").gain("${(0.34 * energy).toFixed(2)} ${(0.2 * energy).toFixed(2)}")
    .dec(.035).degradeBy(${clamp(1 - song.hatDensity, 0.05, 0.5).toFixed(2)})
    .pan(perlin.range(.25, .75).fast(3)),
  s("~ ~ oh ~  ~ ~ ~ oh").gain(${(0.34 * energy).toFixed(2)}).dec(.12),
  s("${grid([4], clap)}").gain(${(0.5 * energy).toFixed(2)}).room(.3),
  s("<~ ~ ~ [sd*4]>").gain(${(0.55 * energy).toFixed(2)}).shape(.4)
).bank("${song.bank}")
  .hpf(220)
  .shape(${(0.2 + o.dirt * 0.3).toFixed(2)})
  .gain(.9)
  .analyze(1)`
}

function schranzAcid(song: Song, o: Opts): string {
  const root = noteName(fold(song.keyRoot, 28, 40))
  const fifth = noteName(fold(song.keyRoot + 7, 28, 40))
  const oct = noteName(fold(song.keyRoot + 12, 28, 42))
  return `$: note("<${root} ${root} ${fifth} ${root} ${oct} ${root} ${fifth} ${oct}>")
  .fast(8)
  .sometimesBy(.22, x => x.add(12))
  .degradeBy(.18)
  .sound("sawtooth")
  .attack(.002).decay(.09).sustain(0).release(.05)
  .lpf(perlin.range(280, ${Math.round(clamp(1800 + o.lpf, 2200, 7000))}).slow(11)).lpq(${(14 + o.dirt * 8).toFixed(0)})
  .shape(${(0.35 + o.dirt * 0.3).toFixed(2)})
  .delay(${(0.16 + o.echo).toFixed(2)}).delaytime(${(o.delayTime * 0.5).toFixed(3)}).delayfeedback(.45)
  .gain(.42).pan(.5)
  .analyze(1)`
}

function schranzDrone(song: Song, o: Opts): string {
  return `$: note("${bassSeq(song, 26, 38)}")
  .struct("x")
  .sound("square")
  .attack(.02).decay(2).sustain(.5).release(1.5)
  .lpf(${Math.round(clamp(160 + o.lpf * 0.06, 140, 420))})
  .shape(.3)
  .gain(.34)
  .analyze(1)`
}

/* ══ ensamblado ════════════════════════════════════════════════════════ */

const AUTHOR_NOTE: Record<DjAuthor | 'local', string> = {
  claude: '// escrito por Claude en los platos',
  grok: '// escrito por Grok en los platos',
  local: '// escrito por el compositor de la emisora',
}

const GENRE_NOTE: Record<Genre, string> = {
  lofi: '// piano eléctrico, swing y cinta gastada',
  house: '// bombo a negras, contratiempo y stabs de sótano',
  schranz: '// bombo a martillo, taladro y ácido — sube el volumen bajo tu responsabilidad',
}

/** Programa Strudel completo del tema. */
export function strudelize(song: Song, vibe: Vibe, p: MoodProfile): string {
  const o = opts(vibe, p)
  const moods = vibe.moods.length ? vibe.moods.join(' + ') : 'sin ambiente'
  const header = [
    `// ✳ ChupitBeats — «${song.title}»`,
    `// ${song.genre.toUpperCase()} · ${moods} · ${vibe.tempo} bpm · ${keyLabel(song)} · ${song.bars} compases`,
    GENRE_NOTE[song.genre],
    AUTHOR_NOTE[song.by ?? 'local'],
    '// (la lluvia y el ruido de calle van por fuera de Strudel, en WebAudio)',
    '',
    `setcpm(${vibe.tempo}/4)`,
    '',
  ].join('\n')

  const layers =
    song.genre === 'house'
      ? [
          '// batería', houseDrums(song, o, p), '',
          '// bajo', houseBass(song, o), '',
          '// stabs', houseStabs(song, o), '',
          '// hook', houseLead(song, o, p), '',
        ]
      : song.genre === 'schranz'
        ? [
            '// bombo', schranzKick(o, p), '',
            '// percusión', schranzPerc(song, o, p), '',
            '// ácido', schranzAcid(song, o), '',
            '// drone', schranzDrone(song, o), '',
          ]
        : [
            '// acordes', lofiChords(song, o), '',
            '// bajo', lofiBass(song, o), '',
            '// melodía', lofiLead(song, o, p), '',
            '// batería', lofiDrums(song, o, p), '',
          ]

  return [header, ...layers].join('\n')
}

/** Sintonía de emisora, tres notas, cuando entra un tema de Claude. */
export function stationIdent(song: Song): string {
  const root = song.keyRoot + 24
  const ns = [root, root + 7, root + 14].map(noteName).join(' ')
  return `note("${ns} ~ ~ ~ ~ ~")
  .sound("triangle")
  .attack(.01).decay(.3).sustain(0).release(.6)
  .room(.5).gain(.3).analyze(1)`
}

export { CHORDS, pick, rnd }
