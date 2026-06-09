import { useState, useRef, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, keymap } from '@codemirror/view';
import './App.css';
import { initVisualEngine, initAudioEngine, evaluateCode, stopEngines } from './audioVisualEngine';

const DEFAULT_CODE = `// Chupits Beat - Live Coding Environment
// Presiona 'Empezar' para inicializar los motores.
// Escribe código de Strudel o Hydra y evalúa con Ctrl+Enter.

// Ejemplo Visual (Hydra)
osc(20, 0.1, 0.8).out();

// Ejemplo Audio (Strudel)
// note("c3 [e3 g3]*2").s("sawtooth").play();
`;

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [isRunning, setIsRunning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use an effect to initialize Hydra early if possible, or wait for user interaction.
  useEffect(() => {
    if (canvasRef.current) {
      // It's safe to initialize Hydra's visual part without audio context
      initVisualEngine(canvasRef.current);
    }
  }, []);

  const handleStart = async () => {
    try {
      await initAudioEngine();
      setIsRunning(true);
      console.log("Motores iniciados");
    } catch (err) {
      console.error("Fallo al iniciar motores:", err);
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    stopEngines();
    console.log("Motores detenidos");
  };

  const handleEvaluate = () => {
    if (isRunning) {
      console.log("Evaluando código...");
      evaluateCode(code);
    }
  };

  const handleAiPrompt = async (promptText: string) => {
    if (!isRunning || !promptText.trim()) return;
    
    // Apuntamos directamente a la Edge Function de producción en Supabase
    const FUNCTION_URL = 'https://onocaxrqornukldmloyv.supabase.co/functions/v1/chupits-ai';
    
    try {
      // Limpiar el código actual para que la IA escriba desde cero o reemplace
      setCode("");

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, currentEditorState: code })
      });

      if (!response.ok || !response.body) {
        throw new Error('Error al conectar con la IA');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedCode = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        streamedCode += chunk;
        
        // Actualizamos el estado con el nuevo fragmento
        setCode(prevCode => prevCode + chunk);
      }
      
      // Una vez terminado, evaluamos automáticamente el código generado! (Autónomo)
      console.log("IA finalizó de escribir. Evaluando...");
      evaluateCode(streamedCode);

    } catch (error) {
      console.error(error);
      setCode(prev => prev + "\n// Error comunicando con la IA.");
    }
  };

  // Keyboard shortcut Ctrl+Enter to evaluate
  const customKeymap = keymap.of([
    {
      key: 'Ctrl-Enter',
      run: () => {
        handleEvaluate();
        return true;
      }
    },
    {
      key: 'Mod-Enter',
      run: () => {
        handleEvaluate();
        return true;
      }
    }
  ]);

  return (
    <div className="app-container">
      {/* Background Canvas for Hydra */}
      <canvas id="chupits-bg-canvas" ref={canvasRef} className="hydra-canvas"></canvas>

      {/* Foreground UI */}
      <div className="ui-layer">
        <header className="header">
          <h1>Chupits Beat</h1>
          <div className="controls">
            <button onClick={handleStart} disabled={isRunning} className="btn-start">Empezar</button>
            <button onClick={handleEvaluate} disabled={!isRunning} className="btn-eval">Evaluar (Ctrl+Enter)</button>
            <button onClick={handleStop} disabled={!isRunning} className="btn-stop">Parar</button>
          </div>
        </header>

        <main className="editor-section">
          <CodeMirror
            value={code}
            height="100%"
            theme="dark"
            extensions={[javascript(), EditorView.lineWrapping, customKeymap]}
            onChange={(value) => setCode(value)}
            className="code-editor"
          />
        </main>

        <footer className="ai-copilot-section">
          <input 
            type="text" 
            placeholder="Dile al DJ de IA qué estilo quieres... (ej. Genera algo de techno oscuro)" 
            className="ai-input"
            disabled={!isRunning}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const promptVal = e.currentTarget.value;
                console.log("Solicitando a IA:", promptVal);
                handleAiPrompt(promptVal);
                e.currentTarget.value = '';
              }
            }}
          />
        </footer>
      </div>
    </div>
  );
}

export default App;
