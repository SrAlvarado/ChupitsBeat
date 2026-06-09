// @ts-nocheck
import { transpiler } from '@strudel/transpiler';
import * as strudelCore from '@strudel/core';
import { mini } from '@strudel/mini';
import { initAudioOnFirstClick, webaudioRepl } from '@strudel/webaudio';
import { registerSynthSounds, registerZZFXSounds, samples } from 'superdough';
import Hydra from 'hydra-synth';

const DS = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';

let hydraInstance = null;
let isAudioInitialized = false;
let replInstance = null;

// Patrón por track. El scheduler siempre recibe stack(A, B).
const trackPatterns: Map<string, unknown> = new Map();

async function rebuildScheduler() {
  if (!replInstance) return;
  const patterns = [...trackPatterns.values()];
  if (patterns.length === 0) { replInstance.stop(); return; }

  const combined = patterns.length === 1
    ? patterns[0]
    : strudelCore.stack(...patterns);

  // setPattern con keep=true para NO reiniciar el reloj
  await replInstance.setPattern(combined, true);

  // Solo arrancar si no estaba ya corriendo
  if (!replInstance.state?.started) replInstance.start();
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

  const MAX_CPS = 2.0; // 120 BPM tope
  window.setCps  = (cps) => replInstance.setCps(Math.min(cps, MAX_CPS));
  window.setcps  = window.setCps;
  window.setCpm  = (cpm) => replInstance.setCps(Math.min(cpm / 60, MAX_CPS));
  window.setcpm  = window.setCpm;
  window.hush    = () => { trackPatterns.clear(); replInstance.stop(); };

  isAudioInitialized = true;
  console.log('[Chupits] Motor listo — samples: bd, sd, hh, oh, cp, RolandTR909...');
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
    .replace(/\.s\(\s*\d+\s*\)/g, '.s("sawtooth")')
    .replace(/\.freq\(([^)]+)\)(?!\s*\.s\()/g, '.freq($1).s("sine")')
    // Clamp setCps/setcps to max 2.0 (120 BPM)
    .replace(/\bset[Cc]ps\(\s*([\d.]+)\s*\)/g, (_, n) =>
      `setCps(${Math.min(parseFloat(n), 2.0)})`
    );
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
