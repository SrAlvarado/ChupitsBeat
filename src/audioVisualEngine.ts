// @ts-nocheck
import { transpiler } from '@strudel/transpiler';
import * as strudelCore from '@strudel/core';
import { mini } from '@strudel/mini';
import { initAudioOnFirstClick, webaudioRepl } from '@strudel/webaudio';
import { registerSynthSounds, registerZZFXSounds } from 'superdough';
import Hydra from 'hydra-synth';

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

  // Exponer todo strudel-core globalmente para que el código generado funcione
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

  // Registrar los sonidos sintetizados built-in (sawtooth, square, triangle, sine, etc.)
  await registerSynthSounds();
  await registerZZFXSounds();

  // Crear el REPL de Strudel con salida webaudio (no iniciar aún — necesita patrón primero)
  replInstance = webaudioRepl();

  // Parchear .play() en Pattern.prototype para que el código generado por la IA funcione
  const Pattern = strudelCore.Pattern;
  if (Pattern && !Pattern.prototype.play) {
    Pattern.prototype.play = function () {
      replInstance.setPattern(this);  // primero el patrón
      replInstance.start();            // luego arrancar
      return this;
    };
  }

  // hush() detiene el scheduler
  window.hush = () => replInstance.stop();

  isAudioInitialized = true;
  console.log("Motor de audio listo.");
}

export function evaluateCode(codeStr: string) {
  try {
    console.log("Evaluando sesión...");

    // 1. Limpiar bloques Markdown que la IA a veces incluye
    let cleanCode = codeStr
      .replace(/```javascript/g, '')
      .replace(/```js/g, '')
      .replace(/```/g, '')
      .trim();

    // 2. Sanitizar métodos de Strudel que no existen pero la IA puede alucinar
    cleanCode = cleanCode.replace(/\.f\(\s*["']lpf["']\s*,\s*([^)]+)\)/g, '.lpf($1)');
    cleanCode = cleanCode.replace(/\.f\(\s*["']hpf["']\s*,\s*([^)]+)\)/g, '.hpf($1)');
    cleanCode = cleanCode.replace(/\.f\(\s*["']bpf["']\s*,\s*([^)]+)\)/g, '.bpf($1)');
    cleanCode = cleanCode.replace(/\.filter\(\s*["']lpf["']\s*,\s*([^)]+)\)/g, '.lpf($1)');
    cleanCode = cleanCode.replace(/\.filter\(\s*["']hpf["']\s*,\s*([^)]+)\)/g, '.hpf($1)');

    // 3. Intentar transpilación (convierte mini notation en JS válido)
    let codeToRun = cleanCode;
    try {
      const transpiled = transpiler(cleanCode, { wrapAsync: false, addReturn: false });
      codeToRun = typeof transpiled === 'string'
        ? transpiled
        : (transpiled.output || transpiled.code || cleanCode);
    } catch {
      console.warn("Transpiler falló, usando código plano.");
    }

    // 4. Ejecutar mediante inyección de script (funciona para Hydra + Strudel con .play() parcheado)
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
