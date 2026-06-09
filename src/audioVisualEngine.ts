// @ts-nocheck
import { transpiler } from '@strudel/transpiler';
import { evaluate } from '@strudel/core';
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
    detectAudio: false, // ¡Crítico! Evita pedir permisos de micrófono
    makeGlobal: true, // Expone osc, src, noise al objeto global (window)
    autoLoop: true,
    width: window.innerWidth,
    height: window.innerHeight
  });
  
  // Fondo base negro
  window.solid(0, 0, 0).out();
  console.log("Hydra inicializado.");
}

/**
 * Inicializa Strudel WebAudio context y enlaza la salida principal hacia Hydra/Meyda.
 */
export async function initAudioEngine() {
  if (isAudioInitialized) return;

  // Strudel WebAudio hook (crea el GainNode principal)
  await initAudioOnFirstClick();
  const ctx = getAudioContext();
  
  if (!ctx) {
    throw new Error("No se pudo obtener el AudioContext de Strudel.");
  }

  console.log("Strudel Audio Context activado:", ctx.state);

  // Intentamos enlazar Meyda al contexto
  if (window.a && window.a.setSource) {
    try {
      // Meyda Analyzer necesita un MediaElementAudioSourceNode o MediaStreamAudioSourceNode 
      // o un nodo de la API de WebAudio válido.
      // Strudel emite sonido a la salida global. Para interceptarlo, vamos a crear un GainNode maestro 
      // improvisado y conectarlo a Meyda.
      
      const meydaAnalyzerNode = ctx.createGain();
      meydaAnalyzerNode.connect(ctx.destination);
      
      // Intentamos engañar a Meyda para que escuche el canal general
      window.a.setSource(meydaAnalyzerNode); 
      window.a.setBins(4);
      window.a.setSmooth(0.8);
      window.a.setCutoff(0.1);
      console.log("Enlace de Meyda/Hydra FFT activado.");
    } catch (err) {
      console.warn("Meyda audio react no pudo enlazar completamente.", err);
    }
  }

  isAudioInitialized = true;
}

/**
 * Transpila y evalúa código en el ecosistema Strudel + Hydra.
 */
export function evaluateCode(codeStr: string) {
  try {
    // 1. Transpilar la mini-notación de Strudel (si la hay)
    // Usamos opciones que garanticen que devuelva el código como string
    const transpiled = transpiler(codeStr, { 
      wrapAsync: false, 
      addReturn: false,
      emitMiniLocations: false 
    });
    
    // Nos aseguramos de obtener la cadena de texto del código
    const codeToEval = typeof transpiled === 'string' ? transpiled : (transpiled.code || transpiled);

    if (typeof codeToEval !== 'string') {
      console.error("El transpiler no devolvió una cadena válida:", codeToEval);
      return;
    }

    console.log("Ejecutando código transpiliado...");

    // 2. Ejecutar el código en el scope global (donde vive Hydra)
    // Usamos el eval indirecto para que se ejecute en el contexto global
    const globalEval = eval;
    globalEval(codeToEval);

    // 3. También intentamos que Strudel procese el código por si acaso
    try {
      evaluate(codeToEval);
    } catch (e) {
      // Ignorar errores si el código contiene funciones de Hydra que Strudel no conoce
    }

    console.log("Evaluación completada.");
    
  } catch (err) {
    console.error("Error transpilando/evaluando el código:", err);
  }
}

/**
 * Detiene los motores (Botón Parar).
 */
export function stopEngines() {
  if (window.hush) {
    window.hush(); // Strudel hush
  }
  if (window.hydra) {
    window.solid(0, 0, 0).out(); // Hydra clear
  }
}
