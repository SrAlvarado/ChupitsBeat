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

  // Registrar sintetizadores built-in y cargar sample banks de batería
  await Promise.all([
    registerSynthSounds(),   // sawtooth, square, triangle, sine
    registerZZFXSounds(),    // sonidos zzfx extra
    samples(`${DS}/Dirt-Samples.json`),          // bd, sd, hh, cp, cr, rd, 808...
    samples(`${DS}/tidal-drum-machines.json`),   // Roland TR-909, 808, 606...
  ]);

  // Crear el REPL de Strudel (no arrancar aún — necesita patrón primero)
  replInstance = webaudioRepl();

  // Parchear .play() para que el código de la IA funcione
  const Pattern = strudelCore.Pattern;
  if (Pattern && !Pattern.prototype.play) {
    Pattern.prototype.play = function () {
      replInstance.setPattern(this);
      replInstance.start();
      return this;
    };
  }

  // Exponer controles del scheduler globalmente para que el código de la IA los use
  window.setCps = (cps) => replInstance.setCps(cps);
  window.setcps = window.setCps;
  window.setCpm = (cpm) => replInstance.setCps(cpm / 60);
  window.setcpm = window.setCpm;
  window.hush   = () => replInstance.stop();

  isAudioInitialized = true;
  console.log("Motor de audio listo. Samples cargados: bd, sd, hh, 808, TR-909...");
}

export function evaluateCode(codeStr: string) {
  try {
    console.log("Evaluando sesión...");

    // 1. Limpiar bloques Markdown
    let cleanCode = codeStr
      .replace(/```javascript/g, '')
      .replace(/```js/g, '')
      .replace(/```/g, '')
      .trim();

    // 2. Sanitizar métodos inexistentes que la IA alucina
    cleanCode = cleanCode.replace(/\.f\(\s*["']lpf["']\s*,\s*([^)]+)\)/g, '.lpf($1)');
    cleanCode = cleanCode.replace(/\.f\(\s*["']hpf["']\s*,\s*([^)]+)\)/g, '.hpf($1)');
    cleanCode = cleanCode.replace(/\.f\(\s*["']bpf["']\s*,\s*([^)]+)\)/g, '.bpf($1)');
    cleanCode = cleanCode.replace(/\.filter\(\s*["']lpf["']\s*,\s*([^)]+)\)/g, '.lpf($1)');
    cleanCode = cleanCode.replace(/\.filter\(\s*["']hpf["']\s*,\s*([^)]+)\)/g, '.hpf($1)');
    // Números MIDI usados como nombre de sonido → sawtooth como fallback
    cleanCode = cleanCode.replace(/\.s\(\s*(\d+)\s*\)/g, '.s("sawtooth")');

    // 3. Intentar transpilación
    let codeToRun = cleanCode;
    try {
      const transpiled = transpiler(cleanCode, { wrapAsync: false, addReturn: false });
      codeToRun = typeof transpiled === 'string'
        ? transpiled
        : (transpiled.output || transpiled.code || cleanCode);
    } catch {
      console.warn("Transpiler falló, usando código plano.");
    }

    // 4. Ejecutar via script injection (soporta Hydra + Strudel con .play() parcheado)
    const executionWrapper = `
      (function() {
        const m = window.m || window.mini;
        const note = window.note;
        const s = window.s;
        const stack = window.stack;
        const osc = window.osc;
        try {
          ${codeToRun}
        } catch (err) {
          console.error("Error dentro del ejecutor:", err);
        }
      })();
    `;

    const script = document.createElement('script');
    script.textContent = executionWrapper;
    document.body.appendChild(script);
    document.body.removeChild(script);

    console.log("Código ejecutado.");
  } catch (err) {
    console.error("Error fatal en evaluación:", err);
  }
}

export function stopEngines() {
  if (replInstance) replInstance.stop();
  if (window.solid) window.solid(0, 0, 0).out();
}
