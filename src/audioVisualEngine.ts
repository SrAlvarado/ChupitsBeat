// @ts-nocheck
import { transpiler } from '@strudel/transpiler';
import * as strudelCore from '@strudel/core';
import { mini } from '@strudel/mini';
import { initAudioOnFirstClick, webaudioRepl } from '@strudel/webaudio';
import { registerSynthSounds, registerZZFXSounds, samples, getAnalyzerData } from 'superdough';
import Hydra from 'hydra-synth';

const DS = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';

let hydraInstance = null;
let isAudioInitialized = false;
let replInstance = null;

// ID del analizador FFT al que enrutamos TODA la mezcla (visuales reactivos).
const MASTER_ANALYZER = 1;
const FFT_PARAM = 4; // fftSize = 2^(4+5) = 512 → 256 bins
// Gain maestro: deja headroom para que la suma de los 2 tracks (varias capas
// cada uno) NO recorte en el destino de Web Audio (que no tiene limitador).
const MASTER_GAIN = 0.55;

// Patrón por track. El scheduler siempre recibe stack(A, B).
const trackPatterns: Map<string, unknown> = new Map();

async function rebuildScheduler() {
  if (!replInstance) return;
  const patterns = [...trackPatterns.values()];
  if (patterns.length === 0) { replInstance.stop(); return; }

  let combined = patterns.length === 1
    ? patterns[0]
    : strudelCore.stack(...patterns);

  // Gain maestro para evitar saturación al sumar ambos tracks.
  try {
    if (typeof (combined as any).gain === 'function') {
      combined = (combined as any).gain(MASTER_GAIN);
    }
  } catch (e) { console.warn('[master gain] no aplicado:', e); }

  // Enruta la mezcla completa a un analizador FFT (envío paralelo, no altera
  // el audio). Así los visuales de Hydra reaccionan al sonido de Strudel, NO
  // al micrófono. `.fft` fija el tamaño de ventana del analizador.
  try {
    if (typeof (combined as any).analyze === 'function') {
      combined = (combined as any).analyze(MASTER_ANALYZER).fft(FFT_PARAM);
    }
  } catch (e) { console.warn('[analyze] no se pudo enrutar FFT:', e); }

  // setPattern con keep=true para NO reiniciar el reloj
  await replInstance.setPattern(combined, true);

  // Solo arrancar si no estaba ya corriendo
  if (!replInstance.state?.started) replInstance.start();
}

// ── Bandas de audio reactivas (FFT) ───────────────────────────────────────
// Un bucle rAF lee el analizador y deja en globales `bass()/mid()/high()` la
// energía 0..1 de cada tercio del espectro. Los presets visuales de Hydra
// referencian estas funciones (Hydra las llama cada fotograma).
const bands = { bass: 0, mid: 0, high: 0, level: 0 };
let bandsRAF = 0;

function updateBands() {
  bandsRAF = requestAnimationFrame(updateBands);
  let data: Float32Array | undefined;
  try { data = getAnalyzerData('frequency', MASTER_ANALYZER) as Float32Array; }
  catch { return; }
  if (!data || data.length === 0) return;

  const n = data.length;
  const third = Math.floor(n / 3) || 1;
  // dB (≈ -100..-10) → energía 0..1.
  const norm = (db: number) => Math.max(0, Math.min(1, (db + 100) / 75));
  let lo = 0, md = 0, hi = 0;
  for (let i = 0; i < third; i++) lo += norm(data[i]);
  for (let i = third; i < third * 2; i++) md += norm(data[i]);
  for (let i = third * 2; i < n; i++) hi += norm(data[i]);
  lo /= third; md /= third; hi /= (n - third * 2) || 1;

  // Suavizado exponencial para evitar parpadeos bruscos.
  const k = 0.35;
  bands.bass = bands.bass + (lo - bands.bass) * k;
  bands.mid  = bands.mid  + (md - bands.mid)  * k;
  bands.high = bands.high + (hi - bands.high) * k;
  bands.level = (bands.bass + bands.mid + bands.high) / 3;
}

function startBands() {
  if (bandsRAF) return;
  // Globales que usan los presets visuales (Hydra los evalúa por fotograma).
  (window as any).bass  = () => bands.bass;
  (window as any).mid   = () => bands.mid;
  (window as any).high  = () => bands.high;
  (window as any).level = () => bands.level;
  updateBands();
}

export function initVisualEngine(canvasElement: HTMLCanvasElement) {
  if (hydraInstance) return;
  hydraInstance = new Hydra({
    canvas: canvasElement,
    detectAudio: false,
    makeGlobal: true,
    autoLoop: true,
    width: window.innerWidth,
    height: window.innerHeight
  });
  window.solid(0, 0, 0).out();
  Object.keys(strudelCore).forEach(key => { window[key] = strudelCore[key]; });
  window.m = mini;
  window.mini = mini;
  startBands(); // arranca el lector FFT y expone bass()/mid()/high()/level()
}

// ── Presets visuales Hydra (curados, reactivos al audio) ──────────────────
// La IA NO escribe código Hydra (riesgo de alucinación). El Director elige un
// preset por género y el FFT del audio modula la geometría en tiempo real.
// `i` = intensidad base (0..1, según la fase del set).
const VISUAL_PRESETS: Record<string, (i: number) => string> = {
  'hard-techno': (i) =>
    `osc(40, 0.02, 1).diff(osc(3, 0.2, 0.8))` +
    `.modulate(noise(() => 2 + bass()*6), () => 0.1 + bass()*0.3)` +
    `.color(() => 0.9 + high()*0.6, 0.08, 0.05).contrast(${(1.4 + i).toFixed(2)})` +
    `.scale(() => 1 + bass()*0.4).out();`,
  'peak-techno': (i) =>
    `osc(20, 0.05, 0.6).kaleid(() => 3 + Math.round(mid()*5))` +
    `.color(0.1, () => 0.4 + high()*0.6, 0.9)` +
    `.rotate(() => time*0.1 + bass()*0.5).modulateScale(osc(6), () => 0.2 + bass()*${(0.4 + i).toFixed(2)})` +
    `.out();`,
  'melodic-techno': (i) =>
    `osc(8, 0.02, 0.4).color(0.5, 0.2, () => 0.7 + high()*0.3)` +
    `.diff(osc(12, 0.01).rotate(0.3))` +
    `.modulate(noise(2), () => 0.05 + mid()*${(0.2 + i * 0.2).toFixed(2)})` +
    `.scale(() => 1.2 + bass()*0.3).blend(o0, 0.5).out();`,
  'tech-house': (i) =>
    `shape(() => 3 + Math.round(mid()*5), 0.4, 0.05)` +
    `.repeat(() => 2 + Math.round(bass()*4), 2)` +
    `.color(() => 1 + high()*0.5, 0.6, 0.1).rotate(() => time*0.2)` +
    `.scrollX(() => bass()*${(0.1 + i * 0.1).toFixed(2)}).out();`,
  'acid': (i) =>
    `osc(30, 0.1, 1).color(0.1, () => 0.9 + high()*0.4, 0.2)` +
    `.modulate(o0, () => 0.2 + bass()*0.6)` +
    `.kaleid(() => 4 + Math.round(mid()*4)).contrast(${(1.3 + i).toFixed(2)}).out();`,
};

/** El Director aplica el preset visual del género, con intensidad por fase. */
export function applyVisual(genreId: string, intensity = 0.5) {
  if (!hydraInstance) return;
  const make = VISUAL_PRESETS[genreId] ?? VISUAL_PRESETS['hard-techno'];
  const code = make(Math.max(0, Math.min(1, intensity)));
  const script = document.createElement('script');
  script.textContent = `try { ${code} } catch(e){ console.warn("[visual]",e); }`;
  document.body.appendChild(script);
  document.body.removeChild(script);
}

export async function initAudioEngine() {
  if (isAudioInitialized) return;
  await initAudioOnFirstClick();
  await Promise.all([
    registerSynthSounds(),
    registerZZFXSounds(),
    samples(`${DS}/EmuSP12.json`).catch(e => console.warn('[samples] EmuSP12:', e)),
    samples(`${DS}/tidal-drum-machines.json`).catch(e => console.warn('[samples] drum-machines:', e)),
  ]);

  replInstance = webaudioRepl();

  const Pattern = strudelCore.Pattern;
  if (Pattern && !Pattern.prototype.play) {
    Pattern.prototype.play = function () {
      const trackId = (window as any).__currentTrack ?? 'A';
      trackPatterns.set(trackId, this);
      rebuildScheduler();   // async pero no bloqueante — correcto
      return this;
    };
  }

  // El tempo lo fija la SESIÓN (el Director), no cada track. Los generadores
  // ya no llaman a setCps (se elimina en sanitize). Mantenemos los globales
  // como no-ops seguros por si llega código antiguo, pero el tempo real lo
  // controla setSessionTempo().
  // Convención: 1 ciclo = 1 compás (4 beats). cps = BPM/240. Techo ~205 BPM.
  const MAX_CPS = 205 / 240;
  const clampCps = (cps) => Math.max(0.4, Math.min(cps, MAX_CPS));
  window.setCps  = () => {};   // ignorado: el track no decide el tempo
  window.setcps  = window.setCps;
  window.setCpm  = () => {};
  window.setcpm  = window.setCpm;
  window.hush    = () => { trackPatterns.clear(); replInstance.stop(); };

  // API de tempo de sesión (solo App/Director la usa)
  (window as any).__clampCps = clampCps;

  isAudioInitialized = true;
  console.log('[Chupits] Motor listo — samples: bd, sd, hh, oh, cp, RolandTR909...');
}

/**
 * El Director fija el tempo de toda la sesión (un único reloj).
 * Strudel usa cps (cycles per second), no BPM. Con 1 ciclo = 1 compás de 4/4
 * (un `s("bd*4")` = los 4 negras del compás): cps = BPM / 240.
 */
export function setSessionTempo(bpm: number) {
  if (!replInstance) return;
  const cps = (window as any).__clampCps?.(bpm / 240) ?? bpm / 240;
  replInstance.setCps(cps);
}

/**
 * Resuelve en la siguiente frontera de frase musical (sincronía rítmica real).
 * En vez de un sleep fijo, lee el ciclo actual del scheduler de Strudel y
 * espera a cruzar el próximo múltiplo de `phraseCycles` ciclos, para que la
 * regeneración de la IA entre a tiempo sin cortar la transición.
 */
export function awaitNextPhrase(phraseCycles = 8, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const sched = replInstance?.scheduler;
    const cps = sched?.cps || 0.5;
    // Si el reloj no está activo, cae a un tiempo equivalente por reloj de pared.
    if (!sched || !sched.started || typeof sched.now !== 'function') {
      const ms = (phraseCycles / cps) * 1000;
      const t = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
      return;
    }
    const start = sched.now();
    const target = Math.ceil((start + 0.001) / phraseCycles) * phraseCycles;
    const tick = () => {
      if (signal?.aborted) return resolve();
      if (sched.now() >= target) return resolve();
      setTimeout(tick, 60);
    };
    tick();
  });
}

function sanitize(code: string): string {
  return code
    .replace(/```javascript\s*/gi, '')
    .replace(/```js\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^javascript\s*\n/gim, '')
    .replace(/^js\s*\n/gim, '')
    .trim()
    .replace(/\.f\(\s*["']lpf["']\s*,\s*([^)]+)\)/g, '.lpf($1)')
    .replace(/\.f\(\s*["']hpf["']\s*,\s*([^)]+)\)/g, '.hpf($1)')
    .replace(/\.f\(\s*["']bpf["']\s*,\s*([^)]+)\)/g, '.bpf($1)')
    .replace(/\.filter\(\s*["']lpf["']\s*,\s*([^)]+)\)/g, '.lpf($1)')
    .replace(/\.filter\(\s*["']hpf["']\s*,\s*([^)]+)\)/g, '.hpf($1)')
    // Sonido numérico sin comillas: .s(194) → sawtooth
    .replace(/\.s\(\s*\d+\s*\)/g, '.s("sawtooth")')
    // Sonido numérico ENTRECOMILLADO: la IA puso números donde va el nombre
    // del sonido — ej. .s("194") o .s("54 104 109"). Strudel lo trata como
    // nombre de sample inexistente y cae a triangle. Lo forzamos a sawtooth.
    .replace(/\.(?:s|sound)\(\s*"[\s\d.~<>]*\d[\s\d.~<>]*"\s*\)/g, '.s("sawtooth")')
    .replace(/\.freq\(([^)]+)\)(?!\s*\.s\()/g, '.freq($1).s("sine")')
    // El tempo lo controla la sesión: elimina cualquier setCps/setCpm que
    // genere la IA para que no pelee por el reloj global.
    .replace(/\bset[Cc]p[sm]\(\s*[\d.]+\s*\)\s*;?/g, '');
}

export function evaluateCode(codeStr: string, trackId: string = 'A') {
  (window as any).__currentTrack = trackId;
  let clean = sanitize(codeStr);
  let codeToRun = clean;
  try {
    const t = transpiler(clean, { wrapAsync: false, addReturn: false });
    codeToRun = typeof t === 'string' ? t : (t.output || t.code || clean);
  } catch { /* usa código plano */ }

  const script = document.createElement('script');
  script.textContent = `(function(){
    const m=window.m||window.mini, note=window.note, s=window.s,
          stack=window.stack, osc=window.osc,
          setCps=window.setCps, setcps=window.setCps, setCpm=window.setCpm;
    try { ${codeToRun} }
    catch(err){ console.error("[Track ${trackId}]",err); }
  })();`;
  document.body.appendChild(script);
  document.body.removeChild(script);
  console.log(`[Track ${trackId}] ejecutado`);
}

export function clearTrack(trackId: string) {
  trackPatterns.delete(trackId);
  rebuildScheduler();
}

export function stopEngines() {
  trackPatterns.clear();
  if (replInstance) replInstance.stop();
  if (window.solid) window.solid(0, 0, 0).out();
}
