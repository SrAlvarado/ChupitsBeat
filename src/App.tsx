import { useState, useRef, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, keymap } from '@codemirror/view';
import './App.css';
import { initVisualEngine, initAudioEngine, evaluateCode, clearTrack, stopEngines } from './audioVisualEngine';

const FUNCTION_URL = 'https://onocaxrqornukldmloyv.supabase.co/functions/v1/chupits-ai';
const AUTO_INTERVAL = 28000; // ms entre generaciones en modo auto

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const TRACK_A_DEFAULT = `// TRACK A — Base
setCps(2.5);
stack(
  s("bd:0*4").gain(0.95),
  s("hh:0*8").gain(0.3).pan("<-0.4 0.4>"),
  s("sd:0").struct("~ x ~ x").gain(0.65)
).play();`;

const TRACK_B_DEFAULT = `// TRACK B — Melodía
note("<c1 eb1 g1 bb1>*2").s("sawtooth").lpf(400).gain(0.7).release(0.08).play();`;

export default function App() {
  const [trackA, setTrackA] = useState(TRACK_A_DEFAULT);
  const [trackB, setTrackB] = useState(TRACK_B_DEFAULT);
  const [isRunning, setIsRunning]   = useState(false);
  const [isAuto, setIsAuto]         = useState(false);
  const [style, setStyle]           = useState('hard techno schranz industrial');
  const [aiTarget, setAiTarget]     = useState<'A'|'B'>('A');
  const [streamingA, setStreamingA] = useState(false);
  const [streamingB, setStreamingB] = useState(false);

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const autoAbort   = useRef<AbortController | null>(null);
  const styleRef    = useRef(style);
  const isRunRef    = useRef(isRunning);
  styleRef.current  = style;
  isRunRef.current  = isRunning;

  useEffect(() => {
    if (canvasRef.current) initVisualEngine(canvasRef.current);
  }, []);

  // ── Streaming de IA a un track ──────────────────────────────────────────
  const streamToTrack = useCallback(async (
    trackId: 'A' | 'B',
    prompt: string,
    signal?: AbortSignal
  ): Promise<void> => {
    const setCode    = trackId === 'A' ? setTrackA : setTrackB;
    const setLoading = trackId === 'A' ? setStreamingA : setStreamingB;

    setLoading(true);
    setCode(`// [IA generando Track ${trackId}...]`);

    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, currentEditorState: '' }),
        signal,
      });
      if (!res.ok || !res.body) throw new Error('Error IA');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      setCode('');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setCode(prev => prev + chunk);
      }

      if (!signal?.aborted) evaluateCode(full, trackId);
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        console.error(`[IA Track ${trackId}]`, err);
        setCode(`// Error IA en Track ${trackId}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Loop autónomo ────────────────────────────────────────────────────────
  const runAutoLoop = useCallback(async (signal: AbortSignal) => {
    let gen = 0;

    const buildPrompt = (track: 'A' | 'B') => {
      const role   = track === 'A' ? 'base rítmica, kicks y percusión' : 'melodía, bassline y texturas';
      const evo    = gen < 2 ? '' : ` — evolución ${Math.ceil(gen / 2) + 1}, más intensa y oscura que la anterior`;
      return `${styleRef.current} — ${role}${evo}`;
    };

    // Arrancar los dos tracks en paralelo la primera vez
    await Promise.all([
      streamToTrack('A', buildPrompt('A'), signal),
      streamToTrack('B', buildPrompt('B'), signal),
    ]);
    gen += 2;

    // Loop alternando tracks cada AUTO_INTERVAL
    while (!signal.aborted && isRunRef.current) {
      await sleep(AUTO_INTERVAL);
      if (signal.aborted) break;

      const track: 'A' | 'B' = gen % 2 === 0 ? 'A' : 'B';
      await streamToTrack(track, buildPrompt(track), signal);
      gen++;
    }
  }, [streamToTrack]);

  const startAuto = useCallback(async () => {
    if (!isRunning) return;
    const ctrl = new AbortController();
    autoAbort.current = ctrl;
    setIsAuto(true);
    runAutoLoop(ctrl.signal).catch(() => {});
  }, [isRunning, runAutoLoop]);

  const stopAuto = useCallback(() => {
    autoAbort.current?.abort();
    autoAbort.current = null;
    setIsAuto(false);
  }, []);

  // ── Motores ──────────────────────────────────────────────────────────────
  const handleStart = async () => {
    try {
      await initAudioEngine();
      setIsRunning(true);
    } catch (err) {
      console.error('Error al iniciar:', err);
    }
  };

  const handleStop = () => {
    stopAuto();
    stopEngines();
    setIsRunning(false);
  };

  // ── Keymaps por track ────────────────────────────────────────────────────
  const codeA = useRef(trackA); codeA.current = trackA;
  const codeB = useRef(trackB); codeB.current = trackB;

  const kmA = keymap.of([
    { key: 'Ctrl-Enter', run: () => { if (isRunning) evaluateCode(codeA.current, 'A'); return true; } },
    { key: 'Mod-Enter',  run: () => { if (isRunning) evaluateCode(codeA.current, 'A'); return true; } },
  ]);
  const kmB = keymap.of([
    { key: 'Ctrl-Enter', run: () => { if (isRunning) evaluateCode(codeB.current, 'B'); return true; } },
    { key: 'Mod-Enter',  run: () => { if (isRunning) evaluateCode(codeB.current, 'B'); return true; } },
  ]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <canvas id="chupits-bg-canvas" ref={canvasRef} className="hydra-canvas" />

      <div className="ui-layer">
        {/* Header */}
        <header className="header">
          <h1>Chupits Beat</h1>
          <div className="controls">
            <button onClick={handleStart} disabled={isRunning}  className="btn-start">Empezar</button>
            <button
              onClick={isAuto ? stopAuto : startAuto}
              disabled={!isRunning}
              className={isAuto ? 'btn-auto-on' : 'btn-auto'}
            >
              {isAuto ? '⏹ Auto ON' : '▶▶ Auto'}
            </button>
            <button onClick={handleStop} disabled={!isRunning} className="btn-stop">Parar</button>
          </div>
        </header>

        {/* Dos editores */}
        <main className="editors-grid">
          <TrackPanel
            id="A"
            code={trackA}
            onChange={setTrackA}
            onEval={() => evaluateCode(trackA, 'A')}
            onClear={() => clearTrack('A')}
            isRunning={isRunning}
            isStreaming={streamingA}
            extensions={[javascript(), EditorView.lineWrapping, kmA]}
          />
          <TrackPanel
            id="B"
            code={trackB}
            onChange={setTrackB}
            onEval={() => evaluateCode(trackB, 'B')}
            onClear={() => clearTrack('B')}
            isRunning={isRunning}
            isStreaming={streamingB}
            extensions={[javascript(), EditorView.lineWrapping, kmB]}
          />
        </main>

        {/* Footer IA */}
        <footer className="ai-copilot-section">
          <div className="ai-track-selector">
            <button
              className={`ai-track-btn ${aiTarget === 'A' ? 'active-a' : ''}`}
              onClick={() => setAiTarget('A')}
            >IA→A</button>
            <button
              className={`ai-track-btn ${aiTarget === 'B' ? 'active-b' : ''}`}
              onClick={() => setAiTarget('B')}
            >IA→B</button>
          </div>

          <input
            type="text"
            className="ai-style-input"
            value={style}
            onChange={e => setStyle(e.target.value)}
            placeholder="Estilo base (usado también en modo Auto)..."
            disabled={!isRunning}
          />

          <input
            type="text"
            className="ai-prompt-input"
            placeholder={`Prompt manual → Track ${aiTarget}  (Enter)`}
            disabled={!isRunning || streamingA || streamingB}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                streamToTrack(aiTarget, e.currentTarget.value || style);
                e.currentTarget.value = '';
              }
            }}
          />
        </footer>
      </div>
    </div>
  );
}

// ── Sub-componente TrackPanel ────────────────────────────────────────────────
interface TrackPanelProps {
  id: 'A' | 'B';
  code: string;
  onChange: (v: string) => void;
  onEval: () => void;
  onClear: () => void;
  isRunning: boolean;
  isStreaming: boolean;
  extensions: unknown[];
}

function TrackPanel({ id, code, onChange, onEval, onClear, isRunning, isStreaming, extensions }: TrackPanelProps) {
  return (
    <div className={`track-panel ${isStreaming ? 'track-streaming' : ''}`}>
      <div className="track-header">
        <span className={`track-label track-${id.toLowerCase()}-label`}>
          {isStreaming ? '⟳ ' : '▶ '}TRACK {id}
        </span>
        <div className="track-controls">
          <button onClick={onEval}  disabled={!isRunning} className="btn-eval">Eval</button>
          <button onClick={onClear} disabled={!isRunning} className="btn-clear">Silenciar</button>
        </div>
      </div>
      <CodeMirror
        value={code}
        height="100%"
        theme="dark"
        extensions={extensions as import('@codemirror/state').Extension[]}
        onChange={onChange}
        className="code-editor"
      />
    </div>
  );
}
