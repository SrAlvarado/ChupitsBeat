// @ts-nocheck
import { transpiler } from '@strudel/transpiler';
import * as strudelCore from '@strudel/core';
import { mini } from '@strudel/mini';
import { initAudioOnFirstClick, getAudioContext } from '@strudel/webaudio';
import Hydra from 'hydra-synth';
import Meyda from 'meyda';

let hydraInstance = null;
let isAudioInitialized = false;

/**
 * Inicializa Hydra y prepara el entorno global.
 */
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
  
  // Exponer TODO de strudel-core globalmente
  Object.keys(strudelCore).forEach(key => {
    window[key] = strudelCore[key];
  });

  // Alias vitales
  window.m = mini;
  window.mini = mini;

  console.log("Motores listos.");
}

export async function initAudioEngine() {
  if (isAudioInitialized) return;
  await initAudioOnFirstClick();
  const ctx = getAudioContext();
  if (window.a && window.a.setSource && ctx) {
    const node = ctx.createGain();
    node.connect(ctx.destination);
    window.a.setSource(node);
  }
  isAudioInitialized = true;
}

/**
 * EVALUADOR DE EMERGENCIA (Bypass del Transpiler problemático)
 */
export function evaluateCode(codeStr: string) {
  try {
    console.log("Evaluando sesión...");
    
    // 1. Limpiamos el código de posibles bloques de Markdown que la IA a veces mete
    let cleanCode = codeStr.replace(/```javascript/g, '').replace(/```js/g, '').replace(/```/g, '').trim();

    // 2. Sanitizamos métodos de Strudel que la IA puede alucinar pero no existen
    // .f("lpf", N) → .lpf(N) | .f("hpf", N) → .hpf(N) | .f("bpf", N) → .bpf(N)
    cleanCode = cleanCode.replace(/\.f\(\s*["']lpf["']\s*,\s*([^)]+)\)/g, '.lpf($1)');
    cleanCode = cleanCode.replace(/\.f\(\s*["']hpf["']\s*,\s*([^)]+)\)/g, '.hpf($1)');
    cleanCode = cleanCode.replace(/\.f\(\s*["']bpf["']\s*,\s*([^)]+)\)/g, '.bpf($1)');
    // .filter("lpf", N) → .lpf(N)
    cleanCode = cleanCode.replace(/\.filter\(\s*["']lpf["']\s*,\s*([^)]+)\)/g, '.lpf($1)');
    cleanCode = cleanCode.replace(/\.filter\(\s*["']hpf["']\s*,\s*([^)]+)\)/g, '.hpf($1)');

    // 3. Intentamos transpilación normal
    let codeToRun = "";
    try {
      const transpiled = transpiler(cleanCode, { wrapAsync: false, addReturn: false });
      codeToRun = typeof transpiled === 'string' ? transpiled : (transpiled.output || transpiled.code || cleanCode);
    } catch (e) {
      console.warn("Transpiler falló, usando código plano.");
      codeToRun = cleanCode;
    }

    // 4. PARCHE CRÍTICO: Si el código transpilado usa 'm(' pero 'm' no es detectada como función global
    // la inyectamos a la fuerza en el momento de la ejecución.
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

    // Ejecución
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
  if (window.hush) window.hush();
  if (window.hydra) window.solid(0, 0, 0).out();
}
