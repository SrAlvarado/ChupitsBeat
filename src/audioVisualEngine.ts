// @ts-nocheck
import { transpiler } from '@strudel/transpiler';
import * as strudelCore from '@strudel/core';
import { mini } from '@strudel/mini';
import { initAudioOnFirstClick, getAudioContext } from '@strudel/webaudio';
import Hydra from 'hydra-synth';
import Meyda from 'meyda';

// Variable global para evitar reinicializaciones
let hydraInstance = null;
let isAudioInitialized = false;

/**
 * Inicializa Hydra de fondo sin capturar micrófono.
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
  
  // EXPOSICIÓN GLOBAL MASIVA PARA EVITAR FUTUROS REFERENCEERRORS
  // 1. Funciones de Strudel Core
  Object.keys(strudelCore).forEach(key => {
    window[key] = strudelCore[key];
  });

  // 2. Alias críticos para el transpiler
  window.m = mini;
  window.mini = mini;

  // 3. Fallback preventivo: si el transpiler genera algo que no tenemos, 
  // que al menos no rompa la ejecución.
  if (typeof window.samples === 'undefined') window.samples = () => ({});

  console.log("Motores y globals cargados (Strudel + Hydra).");
}

/**
 * Inicializa Strudel WebAudio context y enlaza la salida principal hacia Hydra/Meyda.
 */
export async function initAudioEngine() {
  if (isAudioInitialized) return;

  await initAudioOnFirstClick();
  const ctx = getAudioContext();
  
  if (!ctx) {
    throw new Error("No se pudo obtener el AudioContext.");
  }

  if (window.a && window.a.setSource) {
    try {
      // Usamos un GainNode intermedio para Meyda
      const meydaAnalyzerNode = ctx.createGain();
      meydaAnalyzerNode.connect(ctx.destination);
      
      window.a.setSource(meydaAnalyzerNode); 
      window.a.setBins(4);
      window.a.setSmooth(0.8);
      window.a.setCutoff(0.1);
      console.log("Reactividad de audio activada.");
    } catch (err) {
      console.warn("Fallo en enlace Meyda:", err);
    }
  }

  isAudioInitialized = true;
}

/**
 * Transpila y evalúa código en el ecosistema Strudel + Hydra.
 */
export function evaluateCode(codeStr: string) {
  try {
    // ASEGURAR GLOBALS JUSTO ANTES DE EVALUAR
    console.log("Verificando función mini:", mini);
    window.mini = mini;
    window.m = mini;

    // 1. Transpilar con robustez
    const transpiled = transpiler(codeStr, { 
      wrapAsync: false, 
      addReturn: false,
      emitMiniLocations: false 
    });
    
    let codeToEval = '';
    if (typeof transpiled === 'string') {
      codeToEval = transpiled;
    } else if (transpiled && typeof transpiled.output === 'string') {
      codeToEval = transpiled.output;
    } else if (transpiled && typeof transpiled.code === 'string') {
      codeToEval = transpiled.code;
    } else {
      codeToEval = String(transpiled);
    }

    if (!codeToEval || codeToEval === '[object Object]') {
      console.error("Error: Código no válido tras transpilación.");
      return;
    }

    // 2. EVALUACIÓN INDIRECTA GLOBAL
    // Esto asegura que 'm', 'osc', 'stack', etc. se busquen en 'window'
    const globalEval = eval;
    globalEval(codeToEval);

    console.log("Sesión actualizada.");
    
  } catch (err) {
    console.error("Error de ejecución:", err);
  }
}

/**
 * Detiene los motores.
 */
export function stopEngines() {
  if (window.hush) window.hush();
  if (window.hydra) window.solid(0, 0, 0).out();
}
