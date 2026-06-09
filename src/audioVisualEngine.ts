// @ts-nocheck
import { transpiler } from '@strudel/transpiler';
import * as strudelCore from '@strudel/core';
import { mini } from '@strudel/mini';
import { initAudioOnFirstClick, webaudioRepl } from '@strudel/webaudio';
import { registerSynthSounds, registerZZFXSounds, samples } from 'superdough';
import Hydra from 'hydra-synth';

const DS = 'https://raw.githubusercontent.com/felixroos/dough-samples/main';
// EmuSP12.json tiene los nombres cortos: bd, sd, hh, oh, cp, cr, rd, rim, perc
// tidal-drum-machines.json tiene nombres compuestos: RolandTR909_bd, etc.

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
    registerSynthSounds(),
    registerZZFXSounds(),
    // EmuSP12 tiene nombres cortos: bd, sd, hh, oh, cp, cr, rd, rim, perc
    samples(`${DS}/EmuSP12.json`).catch(e => console.warn('[samples] EmuSP12 falló:', e)),
    // Drum machines con nombres compuestos (RolandTR909_bd, etc.)
    samples(`${DS}/tidal-drum-machines.json`).catch(e => console.warn('[samples] drum-machines falló:', e)),
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

    // 1. Limpiar bloques Markdown y palabras sueltas que la IA cuela
    let cleanCode = codeStr
      .replace(/```javascript\s*/gi, '')
      .replace(/```js\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^javascript\s*\n/gim, '')   // "javascript" solo en una línea
      .replace(/^js\s*\n/gim, '')
      .trim();

    // 2. Sanitizar métodos inexistentes que la IA alucina
    cleanCode = cleanCode.replace(/\.f\(\s*["']lpf["']\s*,\s*([^)]+)\)/g, '.lpf($1)');
    cleanCode = cleanCode.replace(/\.f\(\s*["']hpf["']\s*,\s*([^)]+)\)/g, '.hpf($1)');
    cleanCode = cleanCode.replace(/\.f\(\s*["']bpf["']\s*,\s*([^)]+)\)/g, '.bpf($1)');
    cleanCode = cleanCode.replace(/\.filter\(\s*["']lpf["']\s*,\s*([^)]+)\)/g, '.lpf($1)');
    cleanCode = cleanCode.replace(/\.filter\(\s*["']hpf["']\s*,\s*([^)]+)\)/g, '.hpf($1)');
    // .s(número) → .s("sawtooth")  (número literal JS en .s())
    cleanCode = cleanCode.replace(/\.s\(\s*\d+\s*\)/g, '.s("sawtooth")');
    // freq() sin .s() produce números en el slot de sonido — añadir .s("sine")
    cleanCode = cleanCode.replace(/\.freq\(([^)]+)\)(?!\s*\.s\()/g, '.freq($1).s("sine")');

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
