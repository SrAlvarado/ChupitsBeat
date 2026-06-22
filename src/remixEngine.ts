import { PitchShifter } from 'soundtouchjs';

// ════════════════════════════════════════════════════════════════════════
// Remix Engine — secuenciador de schranz en Web Audio (autocontenido).
// Sintetiza kick (pitch-drop + distorsión), hats, clap y bajo, en una rejilla
// de 16 semicorcheas, a un BPM objetivo y en una tonalidad dada. Grafo propio
// → sync exacto y render con OfflineAudioContext (Fase 3c).
// ════════════════════════════════════════════════════════════════════════

const NOTE_SEMITONES: Record<string, number> = {
  c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5, 'f#': 6, gb: 6,
  g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11,
};

/** Nombre de nota (essentia: "A", "C#", "Eb") → frecuencia en una octava. */
export function noteToFreq(name: string, octave = 1): number {
  const key = name.trim().toLowerCase();
  const semis = NOTE_SEMITONES[key] ?? 0;
  const midi = 12 * (octave + 1) + semis;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Curva de distorsión (waveshaper) para el kick/bajo agresivo de schranz.
function distortionCurve(amount: number, n = 1024): Float32Array {
  const curve = new Float32Array(n);
  const k = amount * 100;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * Math.PI) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export interface BaseParams {
  bpm: number;       // tempo objetivo del remix (schranz ~150)
  rootFreq: number;  // frecuencia raíz del bajo (de la tonalidad detectada)
  intensity: number; // 0..1 (densidad/energía → fase del arreglo)
  drums?: boolean;   // kick+hats+clap+perc rodante activos
  bass?: boolean;    // bajo activo
  acid?: boolean;    // línea ácida/stab (el gancho melódico del schranz)
  minorScale?: boolean; // tonalidad menor/frigia (oscura) vs mayor
}

// Riffs ácidos (offsets de semitono sobre la raíz; null = silencio). Octavas
// de lead las pone scheduleStep (+24). Rolling en corcheas → gancho hipnótico.
const RIFF_MINOR: (number | null)[] = [0, null, 12, null, 3, null, 7, null, 0, null, 12, null, 10, null, 7, null];
const RIFF_MAJOR: (number | null)[] = [0, null, 12, null, 4, null, 7, null, 0, null, 12, null, 9, null, 7, null];
// Percusión metálica rodante (5 golpes sincopados sobre 16 = sensación euclídea).
const PERC_ROLL = [false, false, true, false, false, true, false, false, true, false, false, true, false, false, true, false];

// ── Arreglo (journey) con tempo variable ──────────────────────────────────
export interface Section {
  name: string;
  bars: number;      // duración en compases
  bpm: number;       // ¡el tempo varía por sección! (apunte schranz)
  intensity: number;
  drums: boolean;
  bass: boolean;
  acid: boolean;     // gancho ácido/stab
  vocals: boolean;
  lpf: number;       // filtro maestro de la sección (energía)
}

/** Construye un arco de schranz con tempo variable a partir del BPM del drop. */
export function buildArrangement(dropBpm: number): Section[] {
  return [
    { name: 'intro',     bars: 4,  bpm: dropBpm - 6,  intensity: 0.2, drums: false, bass: false, acid: false, vocals: true, lpf: 2200 },
    { name: 'build',     bars: 4,  bpm: dropBpm - 2,  intensity: 0.5, drums: true,  bass: true,  acid: true,  vocals: true, lpf: 6000 },
    { name: 'drop',      bars: 16, bpm: dropBpm,      intensity: 0.9, drums: true,  bass: true,  acid: true,  vocals: true, lpf: 20000 },
    { name: 'breakdown', bars: 8,  bpm: dropBpm - 12, intensity: 0.4, drums: false, bass: true,  acid: true,  vocals: true, lpf: 1600 },
    { name: 'drop 2',    bars: 16, bpm: dropBpm + 2,  intensity: 1.0, drums: true,  bass: true,  acid: true,  vocals: true, lpf: 20000 },
  ];
}

/**
 * Programa UN paso (semicorchea) de la base de schranz en `ctx` en el tiempo `t`.
 * Patrón schranz: kick 4-on-floor, hats en corcheas + open hat offbeat, clap en
 * 2 y 4, bajo sidechain-eado al kick. Reutilizable online (preview) y offline (render).
 */
export function scheduleStep(
  ctx: BaseAudioContext, out: AudioNode, step: number, t: number, p: BaseParams,
) {
  const stepDur = 60 / p.bpm / 4; // duración de una semicorchea
  const beat = step % 4 === 0;    // negra (4-on-floor)
  const offbeat = step % 4 === 2; // contratiempo
  const drums = p.drums !== false;

  // ── KICK (cada negra) ──
  if (drums && beat) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const sh = ctx.createWaveShaper();
    sh.curve = distortionCurve(0.4 + p.intensity * 0.4) as Float32Array<ArrayBuffer>;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    g.gain.setValueAtTime(0.72, t); // kick algo más bajo para que respire la voz
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    osc.connect(sh); sh.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + 0.36);

    // RUMBLE: cola grave saturada (la firma del kick de schranz)
    const r = ctx.createOscillator();
    const rsh = ctx.createWaveShaper();
    rsh.curve = distortionCurve(0.7) as Float32Array<ArrayBuffer>;
    const rg = ctx.createGain();
    r.type = 'sine';
    r.frequency.setValueAtTime(72, t);
    r.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    r.connect(rsh); rsh.connect(rg); rg.connect(out);
    r.start(t); r.stop(t + 0.52);
  }

  // ── HATS (corcheas) + open hat (offbeat) ──
  if (drums && step % 2 === 0) {
    hat(ctx, out, t, beat ? 0.18 : 0.30, 0.03); // cerrado
  }
  if (drums && offbeat) {
    hat(ctx, out, t, 0.32, 0.12); // open hat en el contratiempo
  }

  // ── CLAP (tiempos 2 y 4) ──
  if (drums && (step === 4 || step === 12)) {
    clap(ctx, out, t, 0.4 + p.intensity * 0.2);
  }

  // ── PERCUSIÓN METÁLICA RODANTE (groove hipnótico schranz) ──
  if (drums && PERC_ROLL[step]) {
    metalPerc(ctx, out, t, 0.28 + p.intensity * 0.22);
  }

  // ── ÁCIDO / STAB (el gancho melódico del schranz) ──
  if (p.acid) {
    const riff = p.minorScale === false ? RIFF_MAJOR : RIFF_MINOR;
    const semi = riff[step];
    if (semi !== null && semi !== undefined) {
      acidVoice(ctx, out, t, p.rootFreq * Math.pow(2, (semi + 24) / 12), p.intensity);
    }
  }

  // ── BAJO (rodante, con duck al kick) ──
  if (p.bass !== false) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400 + p.intensity * 600;
    osc.type = 'sawtooth';
    osc.frequency.value = p.rootFreq;
    // sidechain: si hay kick en este paso, el bajo entra agachado y sube.
    const base = 0.5;
    if (beat) {
      g.gain.setValueAtTime(base * 0.25, t);
      g.gain.linearRampToValueAtTime(base, t + stepDur * 0.9);
    } else {
      g.gain.setValueAtTime(base, t);
    }
    g.gain.setValueAtTime(g.gain.value, t + stepDur - 0.005);
    g.gain.linearRampToValueAtTime(0.0001, t + stepDur);
    osc.connect(lp); lp.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + stepDur);
  }
}

function noiseBuffer(ctx: BaseAudioContext, dur: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function hat(ctx: BaseAudioContext, out: AudioNode, t: number, gain: number, dur: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur + 0.02);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 8000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(hp); hp.connect(g); g.connect(out);
  src.start(t); src.stop(t + dur + 0.02);
}

// Percusión metálica corta (ruido por bandpass agudo) para el roll sincopado.
function metalPerc(ctx: BaseAudioContext, out: AudioNode, t: number, gain: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.08);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  src.connect(bp); bp.connect(g); g.connect(out);
  src.start(t); src.stop(t + 0.08);
}

// Voz ácida/stab: sawtooth con lowpass RESONANTE que se abre → el "acid lead"
// que da carácter rave/schranz. `freq` ya viene en la octava de lead.
function acidVoice(ctx: BaseAudioContext, out: AudioNode, t: number, freq: number, intensity: number) {
  const dur = 0.16;
  const osc = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const sh = ctx.createWaveShaper();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  lp.type = 'lowpass'; lp.Q.value = 11; // resonancia alta = acid
  const peak = 1100 + intensity * 2600;
  lp.frequency.setValueAtTime(320, t);
  lp.frequency.exponentialRampToValueAtTime(peak, t + 0.04);
  lp.frequency.exponentialRampToValueAtTime(420, t + dur);
  sh.curve = distortionCurve(0.22) as Float32Array<ArrayBuffer>;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.42, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(lp); lp.connect(sh); sh.connect(g); g.connect(out);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function clap(ctx: BaseAudioContext, out: AudioNode, t: number, gain: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.18);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  src.connect(bp); bp.connect(g); g.connect(out);
  src.start(t); src.stop(t + 0.18);
}

/** Reproductor en vivo de la base (preview). Scheduler con lookahead. */
export class RemixPlayer {
  private ctx: AudioContext;
  private master: GainNode;
  private masterLPF: BiquadFilterNode;
  private vocalsGain: GainNode;
  private timer = 0;
  private step = 0;
  private bar = 0;
  private secIdx = -1;
  private arrangement: Section[] | null = null;
  private nextTime = 0;
  private params: BaseParams;
  playing = false;
  onSection: ((s: Section, index: number) => void) | null = null;

  // Voz original (stem) encajada al BPM con time-stretch (preserva el tono).
  private vocalsBuf: AudioBuffer | null = null;
  private vocalsBpm = 0;
  private shifter: { tempo: number; pitchSemitones: number; connect: (n: AudioNode) => void; disconnect: () => void } | null = null;
  vocalsOn = false;

  constructor(params: BaseParams) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    // Filtro maestro para la curva de energía por sección.
    this.masterLPF = this.ctx.createBiquadFilter();
    this.masterLPF.type = 'lowpass';
    this.masterLPF.frequency.value = 20000;
    this.master.connect(this.masterLPF);
    this.masterLPF.connect(this.ctx.destination);
    // Bus de voz, un poco por encima para que destaque sobre la base.
    this.vocalsGain = this.ctx.createGain();
    this.vocalsGain.gain.value = 1.3;
    this.vocalsGain.connect(this.master);
    this.params = params;
  }

  /** Define el arreglo (journey) que seguirá el reproductor. */
  setArrangement(sections: Section[] | null) { this.arrangement = sections; }

  /** Aplica los parámetros de una sección (tempo, energía, elementos, filtro). */
  private applySection(i: number) {
    const a = this.arrangement;
    if (!a || !a[i]) return;
    const s = a[i];
    this.secIdx = i;
    this.setParams({ bpm: s.bpm, intensity: s.intensity, drums: s.drums, bass: s.bass, acid: s.acid });
    const now = this.ctx.currentTime;
    this.masterLPF.frequency.cancelScheduledValues(now);
    this.masterLPF.frequency.setTargetAtTime(s.lpf, now, 0.3);
    // voz on/off según la sección (y el toggle del usuario)
    if (this.playing) {
      if (this.vocalsOn && s.vocals) this.startVocals();
      else this.stopVocals();
    }
    this.onSection?.(s, i);
  }

  setParams(p: Partial<BaseParams>) {
    this.params = { ...this.params, ...p };
    if (this.shifter && this.vocalsBpm) this.shifter.tempo = this.params.bpm / this.vocalsBpm;
  }

  /** Carga el stem de voz/melodía en el contexto del player. */
  async loadVocals(url: string, originalBpm: number) {
    const ab = await (await fetch(url)).arrayBuffer();
    this.vocalsBuf = await this.ctx.decodeAudioData(ab);
    this.vocalsBpm = originalBpm > 0 ? originalBpm : this.params.bpm;
  }

  private startVocals() {
    if (!this.vocalsBuf || this.shifter) return;
    const s = new PitchShifter(this.ctx, this.vocalsBuf, 4096) as {
      tempo: number; pitchSemitones: number; connect: (n: AudioNode) => void; disconnect: () => void;
    };
    s.tempo = this.params.bpm / (this.vocalsBpm || this.params.bpm); // stretch al BPM objetivo
    s.pitchSemitones = 0; // la base ya está en el tono del tema → sin pitch-shift
    s.connect(this.vocalsGain);
    this.shifter = s;
  }

  private stopVocals() {
    if (this.shifter) { try { this.shifter.disconnect(); } catch { /* noop */ } this.shifter = null; }
  }

  /** Activa/desactiva la voz original sobre la base. */
  setVocals(on: boolean) {
    this.vocalsOn = on;
    if (!this.playing) return;
    if (on) this.startVocals(); else this.stopVocals();
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.ctx.resume();
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.bar = 0;
    this.secIdx = -1;
    if (this.arrangement) this.applySection(0);   // arranca en la 1ª sección
    else if (this.vocalsOn) this.startVocals();    // modo base simple
    const lookahead = 0.025, ahead = 0.1;
    const tick = () => {
      while (this.nextTime < this.ctx.currentTime + ahead) {
        scheduleStep(this.ctx, this.master, this.step, this.nextTime, this.params);
        this.nextTime += 60 / this.params.bpm / 4;
        this.step = (this.step + 1) % 16;
        if (this.step === 0) { this.bar++; this.advanceSection(); } // nuevo compás
      }
    };
    this.timer = window.setInterval(tick, lookahead * 1000);
  }

  private advanceSection() {
    const a = this.arrangement;
    if (!a) return;
    const total = a.reduce((n, s) => n + s.bars, 0);
    if (this.bar >= total) this.bar = 0; // loop del arreglo
    let acc = 0, idx = 0;
    for (let i = 0; i < a.length; i++) {
      if (this.bar < acc + a[i].bars) { idx = i; break; }
      acc += a[i].bars;
    }
    if (idx !== this.secIdx) this.applySection(idx);
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    this.timer = 0;
    this.stopVocals();
    this.ctx.suspend();
  }

  dispose() { this.stop(); this.ctx.close(); }
}
