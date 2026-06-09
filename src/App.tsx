import { useState, useRef, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, keymap } from '@codemirror/view';
import './App.css';
import { initVisualEngine, initAudioEngine, evaluateCode, clearTrack, stopEngines } from './audioVisualEngine';

const TRACK_A_DEFAULT = `// TRACK A — Base / Kick
// Ctrl+Enter para evaluar este track

setCps(2.5);
stack(
  s("bd:0*4").gain(0.95),
  s("hh:0*8").gain(0.3).pan("<-0.4 0.4>"),
  s("sd:0").struct("~ x ~ x").gain(0.65)
).play();
`;

const TRACK_B_DEFAULT = `// TRACK B — Melodía / Capa extra
// Ctrl+Enter para evaluar este track

note("<c1 eb1 g1 bb1>*2").s("sawtooth").lpf(400).gain(0.7).release(0.08).play();
`;

const FUNCTION_URL = 'https://onocaxrqornukldmloyv.supabase.co/functions/v1/chupits-ai';

function App() {
  const [trackA, setTrackA] = useState(TRACK_A_DEFAULT);
  const [trackB, setTrackB] = useState(TRACK_B_DEFAULT);
  const [isRunning, setIsRunning] = useState(false);
  const [activeAiTrack, setActiveAiTrack] = useState<'A' | 'B'>('A');
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) initVisualEngine(canvasRef.current);
  }, []);

  const handleStart = async () => {
    try {
      await initAudioEngine();
      setIsRunning(true);
    } catch (err) {
      console.error("Fallo al iniciar motores:", err);
    }
  };

  const handleStop = () => {
    stopEngines();
    setIsRunning(false);
  };

  const makeKeymap = useCallback((trackId: 'A' | 'B', getCode: () => string) =>
    keymap.of([
      {
        key: 'Ctrl-Enter',
        run: () => { if (isRunning) evaluateCode(getCode(), trackId); return true; }
      },
      {
        key: 'Mod-Enter',
        run: () => { if (isRunning) evaluateCode(getCode(), trackId); return true; }
      }
    ]), [isRunning]);

  const trackACode = useRef(trackA);
  const trackBCode = useRef(trackB);
  trackACode.current = trackA;
  trackBCode.current = trackB;

  const keymapA = makeKeymap('A', () => trackACode.current);
  const keymapB = makeKeymap('B', () => trackBCode.current);

  const streamAi = async (trackId: 'A' | 'B', promptText: string) => {
    if (!isRunning || !promptText.trim()) return;
    const setCode = trackId === 'A' ? setTrackA : setTrackB;
    const setLoading = trackId === 'A' ? setLoadingA : setLoadingB;

    setLoading(true);
    setCode('');

    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText, currentEditorState: '' })
      });

      if (!response.ok || !response.body) throw new Error('Error al conectar con la IA');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setCode(prev => prev + chunk);
      }

      evaluateCode(full, trackId);
    } catch (err) {
      console.error(err);
      setCode('// Error comunicando con la IA.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <canvas id="chupits-bg-canvas" ref={canvasRef} className="hydra-canvas" />

      <div className="ui-layer">
        <header className="header">
          <h1>Chupits Beat</h1>
          <div className="controls">
            <button onClick={handleStart} disabled={isRunning} className="btn-start">Empezar</button>
            <button onClick={handleStop} disabled={!isRunning} className="btn-stop">Parar todo</button>
          </div>
        </header>

        <main className="editors-grid">
          {/* TRACK A */}
          <div className="track-panel">
            <div className="track-header">
              <span className="track-label track-a-label">▶ TRACK A</span>
              <div className="track-controls">
                <button
                  onClick={() => evaluateCode(trackA, 'A')}
                  disabled={!isRunning}
                  className="btn-eval"
                  title="Ctrl+Enter"
                >Evaluar</button>
                <button
                  onClick={() => clearTrack('A')}
                  disabled={!isRunning}
                  className="btn-clear"
                >Silenciar</button>
              </div>
            </div>
            <CodeMirror
              value={trackA}
              height="100%"
              theme="dark"
              extensions={[javascript(), EditorView.lineWrapping, keymapA]}
              onChange={setTrackA}
              className="code-editor"
            />
          </div>

          {/* TRACK B */}
          <div className="track-panel">
            <div className="track-header">
              <span className="track-label track-b-label">▶ TRACK B</span>
              <div className="track-controls">
                <button
                  onClick={() => evaluateCode(trackB, 'B')}
                  disabled={!isRunning}
                  className="btn-eval"
                  title="Ctrl+Enter"
                >Evaluar</button>
                <button
                  onClick={() => clearTrack('B')}
                  disabled={!isRunning}
                  className="btn-clear"
                >Silenciar</button>
              </div>
            </div>
            <CodeMirror
              value={trackB}
              height="100%"
              theme="dark"
              extensions={[javascript(), EditorView.lineWrapping, keymapB]}
              onChange={setTrackB}
              className="code-editor"
            />
          </div>
        </main>

        <footer className="ai-copilot-section">
          <div className="ai-track-selector">
            <button
              className={`ai-track-btn ${activeAiTrack === 'A' ? 'active-a' : ''}`}
              onClick={() => setActiveAiTrack('A')}
            >IA → A</button>
            <button
              className={`ai-track-btn ${activeAiTrack === 'B' ? 'active-b' : ''}`}
              onClick={() => setActiveAiTrack('B')}
            >IA → B</button>
          </div>
          <input
            type="text"
            placeholder={`Dile a la IA qué generar para el Track ${activeAiTrack}... (ej: schranz hardcore)`}
            className={`ai-input ${loadingA || loadingB ? 'ai-loading' : ''}`}
            disabled={!isRunning || loadingA || loadingB}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                streamAi(activeAiTrack, e.currentTarget.value);
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
