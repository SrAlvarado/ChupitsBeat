// ════════════════════════════════════════════════════════════════════════
// CHUPITS — Conocimiento musical curado (estilo Beatport) + Director / DJ
// ────────────────────────────────────────────────────────────────────────
// Beatport no expone una API pública gratuita, así que codificamos aquí sus
// CONVENCIONES de género (rango de BPM, tonalidades, estructura, paleta de
// sonidos). El "Director" usa este catálogo para fijar una Sesión coherente
// (un solo BPM, una sola tonalidad, una fase del set) y reparte restricciones
// a los dos generadores (Track A = ritmo, Track B = bajo/melodía).
// ════════════════════════════════════════════════════════════════════════

export type TrackRole = 'drums' | 'bassMelody';
export type Phase = 'intro' | 'build' | 'peak' | 'breakdown';

export interface GenreSpec {
  id: string;
  name: string;
  /** Palabras clave para mapear texto libre del DJ a este género. */
  match: string[];
  /** Rango de BPM canónico en Beatport para este género. */
  bpm: { min: number; max: number; default: number };
  /** Notas raíz típicas (graves, para techno/house oscuro). */
  roots: string[];
  /** Escalas que dan el carácter del género. */
  scales: string[];
  /** Descripción del kick para el prompt del generador de ritmo. */
  kick: string;
  /** Descripción de hats/percusión. */
  perc: string;
  /** Carácter del bajo/sintetizador. */
  bass: string;
  /** Sonidos recomendados del catálogo del motor. */
  palette: { drums: string[]; synths: string[] };
  /** Descriptor de ambiente para guiar a la IA. */
  vibe: string;
  /** Estilo de visuales Hydra. */
  visual: string;
}

// ── Catálogo de géneros (datos canónicos estilo Beatport) ─────────────────
export const GENRES: GenreSpec[] = [
  {
    id: 'hard-techno',
    name: 'Hard Techno / Schranz',
    match: ['hard techno', 'schranz', 'hard', 'industrial techno', 'rave'],
    bpm: { min: 120, max: 126, default: 124 },
    roots: ['c', 'd', 'e', 'f', 'g'],
    scales: ['phrygian', 'minor', 'locrian'],
    kick: 'kick distorsionado 4-on-floor implacable, posible doble kick en peak',
    perc: 'hats offbeat agresivos, claps en 2 y 4, percusión metálica sincopada',
    bass: 'bajo rasgado tipo sawtooth/square, rolling, muy filtrado y oscuro',
    palette: {
      drums: ['RolandTR909_bd', 'bd', 'hh', 'oh', 'cp', 'rim', 'perc', 'cr'],
      synths: ['sawtooth', 'square'],
    },
    vibe: 'crudo, oscuro, hipnótico, industrial, energía de búnker',
    visual: 'estroboscópico rojo/blanco, alto contraste, movimiento agresivo',
  },
  {
    id: 'peak-techno',
    name: 'Peak Time / Driving Techno',
    match: ['peak', 'driving', 'techno', 'warehouse'],
    bpm: { min: 118, max: 124, default: 122 },
    roots: ['a', 'c', 'd', 'e'],
    scales: ['minor', 'phrygian', 'dorian'],
    kick: 'kick 909 redondo y potente 4-on-floor, con cola controlada',
    perc: 'hats rodantes en corcheas/semicorcheas, ride abierto, percusión tribal puntual',
    bass: 'bajo rodante en una nota raíz, sub limpio, sigue el kick',
    palette: {
      drums: ['RolandTR909_bd', 'bd', 'hh', 'oh', 'rim', 'perc'],
      synths: ['sawtooth', 'triangle'],
    },
    vibe: 'hipnótico, conductor, atmósfera de pista a las 3am',
    visual: 'túneles oscuros azul/cian, partículas, profundidad',
  },
  {
    id: 'melodic-techno',
    name: 'Melodic Techno / Progressive',
    match: ['melodic', 'progressive', 'melódico', 'deep techno', 'afterlife'],
    bpm: { min: 116, max: 122, default: 120 },
    roots: ['a', 'c', 'd', 'f'],
    scales: ['minor', 'dorian', 'harmonicMinor'],
    kick: 'kick suave y profundo 4-on-floor, deja espacio a la melodía',
    perc: 'hats discretos con groove, shaker, percusión con reverb',
    bass: 'bassline melódico envolvente, sub redondo, arpegios filtrados',
    palette: {
      drums: ['bd', 'hh', 'oh', 'cp', 'perc'],
      synths: ['sawtooth', 'triangle', 'sine'],
    },
    vibe: 'emotivo, cinematográfico, espacioso, atmósfera profunda',
    visual: 'gradientes lentos violeta/azul, flujos suaves, niebla',
  },
  {
    id: 'tech-house',
    name: 'Tech House',
    match: ['tech house', 'house groovy', 'groove', 'tech-house'],
    bpm: { min: 120, max: 124, default: 122 },
    roots: ['c', 'e', 'g', 'a'],
    scales: ['minor', 'dorian', 'mixolydian'],
    kick: 'kick seco y compacto 4-on-floor, con swing',
    perc: 'hats con shuffle/swing, claps, bongos y percusión latina',
    bass: 'bajo saltarín y funky, notas cortas con groove off-beat',
    palette: {
      drums: ['RolandTR808_bd', 'bd', 'hh', 'oh', 'cp', 'rim', 'perc'],
      synths: ['sawtooth', 'square', 'sine'],
    },
    vibe: 'groovy, bailable, cálido, con swing',
    visual: 'colores cálidos naranja/amarillo, movimiento rítmico fluido',
  },
  {
    id: 'acid',
    name: 'Acid Techno',
    match: ['acid', '303', 'acido', 'ácido'],
    bpm: { min: 120, max: 126, default: 124 },
    roots: ['c', 'd', 'a'],
    scales: ['phrygian', 'minor'],
    kick: 'kick 909 directo 4-on-floor',
    perc: 'hats rectos, claps, percusión escasa para dejar brillar el 303',
    bass: 'línea acid 303 resonante: sawtooth con lpf modulado y resonancia alta',
    palette: {
      drums: ['RolandTR909_bd', 'bd', 'hh', 'oh', 'cp'],
      synths: ['sawtooth', 'square'],
    },
    vibe: 'ácido, hipnótico, retro-rave, squelchy',
    visual: 'feedback verde fosforito, patrones que se retuercen',
  },
];

export const DEFAULT_GENRE = GENRES[0];

// ── Estructura del set: fases y presupuesto de densidad por rol ───────────
// El "presupuesto" limita cuántos eventos por ciclo y capas puede meter cada
// generador. Es la clave contra el "ritmo muy elevado / pared de sonido".
export interface PhaseBudget {
  /** Texto que describe la energía de esta fase para el prompt. */
  energy: string;
  drums: { maxLayers: number; maxEventsPerCycle: number; note: string };
  bassMelody: { maxLayers: number; maxEventsPerCycle: number; note: string };
}

export const PHASES: Phase[] = ['intro', 'build', 'peak', 'breakdown'];

export const PHASE_BUDGET: Record<Phase, PhaseBudget> = {
  intro: {
    energy: 'baja — solo cimientos, mucho espacio y silencio',
    drums: { maxLayers: 2, maxEventsPerCycle: 8, note: 'solo kick + un hat suave. Deja respirar.' },
    bassMelody: { maxLayers: 1, maxEventsPerCycle: 4, note: 'bajo mínimo o silencio, notas largas.' },
  },
  build: {
    energy: 'creciente — añade tensión progresivamente',
    drums: { maxLayers: 3, maxEventsPerCycle: 12, note: 'kick + hats + una percusión. Sin saturar.' },
    bassMelody: { maxLayers: 2, maxEventsPerCycle: 8, note: 'bassline presente, melodía insinuada.' },
  },
  peak: {
    energy: 'máxima — momento de pista, pero con criterio',
    drums: { maxLayers: 4, maxEventsPerCycle: 16, note: 'percusión completa con groove, NUNCA todo a la vez sin acentos.' },
    bassMelody: { maxLayers: 2, maxEventsPerCycle: 12, note: 'bassline rodante + melodía/stab definida.' },
  },
  breakdown: {
    energy: 'caída — quita el kick, deja atmósfera y melodía',
    drums: { maxLayers: 1, maxEventsPerCycle: 4, note: 'SIN kick o muy reducido. Solo textura/percusión con reverb.' },
    bassMelody: { maxLayers: 2, maxEventsPerCycle: 8, note: 'melodía/pad protagonista, espacioso y emotivo.' },
  },
};

// ── Estado de la Sesión (lo que el Director bloquea para todos) ───────────
export interface Session {
  genre: GenreSpec;
  bpm: number;
  root: string;   // p.ej. "c2"
  scale: string;  // p.ej. "phrygian"
  phase: Phase;
  generation: number;
}

// ── Director / DJ paralelo ────────────────────────────────────────────────

/** Mapea el texto libre del DJ al género más cercano del catálogo. */
export function matchGenre(styleText: string): GenreSpec {
  const t = (styleText || '').toLowerCase();
  let best: GenreSpec | null = null;
  let bestScore = 0;
  for (const g of GENRES) {
    const score = g.match.reduce((acc, kw) => (t.includes(kw) ? acc + kw.length : acc), 0);
    if (score > bestScore) { bestScore = score; best = g; }
  }
  return best ?? DEFAULT_GENRE;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** El Director arranca una sesión coherente a partir del estilo pedido. */
export function startSession(styleText: string): Session {
  const genre = matchGenre(styleText);
  return {
    genre,
    bpm: genre.bpm.default,
    root: `${pick(genre.roots)}2`,
    scale: pick(genre.scales),
    phase: 'intro',
    generation: 0,
  };
}

// Progresión de fases del set (arco DJ): intro → build → peak → break → ...
const PHASE_FLOW: Phase[] = ['intro', 'build', 'peak', 'peak', 'breakdown', 'build', 'peak'];

/** Avanza la sesión una generación: rota la fase del set. */
export function advanceSession(s: Session): Session {
  const generation = s.generation + 1;
  return { ...s, generation, phase: PHASE_FLOW[generation % PHASE_FLOW.length] };
}

/** BPM convertido a cps de Strudel. */
export function bpmToCps(bpm: number): number {
  return bpm / 60;
}

/** Lo que el Director envía a la edge function para un track concreto. */
export interface Directive {
  role: TrackRole;
  genre: string;
  vibe: string;
  bpm: number;
  key: string;        // "c2:phrygian"
  phase: Phase;
  energy: string;
  budget: { maxLayers: number; maxEventsPerCycle: number; note: string };
  palette: string[];
  soundHint: string;  // kick/perc o bass según rol
  visual: string;
}

export function buildDirective(s: Session, role: TrackRole): Directive {
  const b = PHASE_BUDGET[s.phase];
  const isDrums = role === 'drums';
  return {
    role,
    genre: s.genre.name,
    vibe: s.genre.vibe,
    bpm: s.bpm,
    key: `${s.root}:${s.scale}`,
    phase: s.phase,
    energy: b.energy,
    budget: isDrums ? b.drums : b.bassMelody,
    palette: isDrums ? s.genre.palette.drums : s.genre.palette.synths,
    soundHint: isDrums ? `${s.genre.kick}. ${s.genre.perc}` : s.genre.bass,
    visual: s.genre.visual,
  };
}
