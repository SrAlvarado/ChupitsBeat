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

// Mapa de patrones por track: { 'A': Pattern, 'B': Pattern }
const trackPatterns: Map<string, unknown> = new Map();

function rebuildScheduler() {
  if (!replInstance) return;
  const patterns = [...trackPatterns.values()];
  if (patterns.length === 0) { replInstance.stop(); return; }
  const combined = patterns.length === 1
    ? patterns[0]
    : strudelCore.stack(...patterns);
  replInstance.setPattern(combined);
  replInstance.start();
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

  Object.keys(strudelCore).forEach(key => {
    window[key] = strudelCore[key];
  });

  window.m = mini;
  window.mini = mini;

  console.log("Motor visual listo.");
}

export async function initAudioEngine() {
  if (isAudioInitialized) return;

  await initAudioOnFirstClick();

  await Promise.all([
    registerSynthSounds(),
    registerZZFXSounds(),
    samples(`${DS}/EmuSP12.json`).catch(e => console.warn('[samples] EmuSP12 falló:', e)),
    samples(`${DS}/tidal-drum-machines.json`).catch(e => console.warn('[samples] drum-machines falló:', e)),
  ]);

  replInstance = webaudioRepl();

  // Parchear .play() para que registre el patrón en el track activo
  const Pattern = strudelCore.Pattern;
  if (Pattern && !Pattern.prototype.play) {
    Pattern.prototype.play = function () {
      const trackId = (window as any).__currentTrack ?? 'A';
      trackPatterns.set(trackId, this);
      rebuildScheduler();
      return this;
    };
  }

  window.setCps = (cps) => replInstance.setCps(cps);
  window.setcps = window.setCps;
  window.setCpm = (cpm) => replInstance.setCps(cpm / 60);
  window.setcpm = window.setCpm;
  window.hush   = () => { trackPatterns.clear(); replInstance.stop(); };

  isAudioInitialized = true;
  console.log("Motor de audio listo.");
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
    .replace(/\.freq\(([^)]+)\)(?!\s*\.s\()/g, '.freq($1).s("sine")');
}

export function evaluateCode(codeStr: string, trackId: string = 'A') {
  try {
    (window as any).__currentTrack = trackId;

    let cleanCode = sanitize(codeStr);

    let codeToRun = cleanCode;
    try {
      const transpiled = transpiler(cleanCode, { wrapAsync: false, addReturn: false });
      codeToRun = typeof transpiled === 'string'
        ? transpiled
        : (transpiled.output || transpiled.code || cleanCode);
    } catch {
      console.warn("Transpiler falló, usando código plano.");
    }

    const executionWrapper = `
      (function() {
        const m = window.m || window.mini;
        const note = window.note;
        const s = window.s;
        const stack = window.stack;
        const osc = window.osc;
        const setCps = window.setCps;
        const setcps = window.setCps;
        const setCpm = window.setCpm;
        try {
          ${codeToRun}
        } catch (err) {
          console.error("[Track ${trackId}] Error:", err);
        }
      })();
    `;

    const script = document.createElement('script');
    script.textContent = executionWrapper;
    document.body.appendChild(script);
    document.body.removeChild(script);

    console.log(`[Track ${trackId}] Código ejecutado.`);
  } catch (err) {
    console.error(`[Track ${trackId}] Error fatal:`, err);
  }
}

export function clearTrack(trackId: string) {
  trackPatterns.delete(trackId);
  rebuildScheduler();
  console.log(`[Track ${trackId}] Limpiado.`);
}

export function stopEngines() {
  trackPatterns.clear();
  if (replInstance) replInstance.stop();
  if (window.solid) window.solid(0, 0, 0).out();
}
