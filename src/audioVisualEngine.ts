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

  // Enlazar Strudel GainNode hacia el analizador FFT de Hydra (a través de Meyda)
  if (window.a && window.a.setSource) {
    try {
      // Necesitamos ubicar el nodo de salida final de Strudel. 
      // Por convención en Strudel, getAudioContext().destination es el final, pero la señal 
      // pasa por un GainNode global. Intentemos con la salida principal.
      // Si tenemos problemas de ruteo, usaremos un truco de Meyda Analyzer.
      
      // Asumiremos que ctx.destination está conectado. Para rutear hacia Hydra sin que Strudel 
      // tenga una API explícita de "getMasterNode()", capturamos la señal del contexto.
      // @ts-ignore
      const gainNode = window.__strudelAudioGainNode || ctx.createGain(); // Si usamos un hook propio
      
      window.a.setSource(ctx.destination); // O intentar inyectar
      window.a.setBins(4);
      window.a.setSmooth(0.8);
      window.a.setCutoff(0.1);
      console.log("Enlace de Meyda/Hydra FFT establecido con éxito.");
    } catch (err) {
      console.warn("Meyda audio react no pudo enlazar el nodo origen (source node).", err);
    }
  }

  isAudioInitialized = true;
}

/**
 * Transpila y evalúa código en el ecosistema Strudel + Hydra.
 */
export function evaluateCode(codeStr: string) {
  try {
    // Para Hydra: comandos como `osc().out()` pueden ejecutarse directamente usando eval nativo
    // pero idealmente transpilaremos todo para no bloquear.
    
    // Primero transpilamos el código de Strudel (convierte la mini-notación a JS)
    const transpiled = transpiler(codeStr, { wrapAsync: false });
    
    // Evaluamos. @strudel/core 'evaluate' ya maneja la ejecución en su contexto.
    // getScope() expone las funciones disponibles (note, s, stack, etc.)
    // Pero como Hydra es global (window), el eval() interno de evaluateCode debe alcanzarlo.
    
    // Evaluamos el JS final.
    // transpiled contiene el AST regenerado a string, normalmente transpiled.code o el string directo.
    const codeToEval = typeof transpiled === 'string' ? transpiled : transpiled.code || transpiled;
    
    // Ejecución. Podría ser un window.eval() o la función nativa de Strudel.
    evaluate(codeToEval);
    console.log("Evaluación exitosa.");
    
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
