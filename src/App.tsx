import { useState, useRef, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, keymap } from '@codemirror/view';
import './App.css';
import { initVisualEngine, initAudioEngine, evaluateCode, clearTrack, stopEngines, setSessionTempo } from './audioVisualEngine';
import {
  GENRES, startSession, advanceSession, buildDirective,
  type Session, type TrackRole,
} from './musicKnowledge';

const FUNCTION_URL = 'https://onocaxrqornukldmloyv.supabase.co/functions/v1/chupits-ai';
const AUTO_INTERVAL = 28000; // ms entre generaciones en modo auto

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const TRACK_A_DEFAULT = `// TRACK A — Ritmo
stack(
  s("bd:0*4").gain(0.95),
  s("hh:0*8").gain(0.3).pan("<-0.4 0.4>"),
  s("sd:0").struct("~ x ~ x").gain(0.65)
).play();`;

const TRACK_B_DEFAULT = `// TRACK B — Bajo / Melodía
note("<c2 eb2 g2 bb2>").s("sawtooth").lpf(400).gain(0.7).release(0.12).play();`;

export default function App() {
  const [trackA, setTrackA] = useState(TRACK_A_DEFAULT);
  const [trackB, setTrackB] = useState(TRACK_B_DEFAULT);
  const [isRunning, setIsRunning]   = useState(false);
  const [isAuto, setIsAuto]         = useState(false);
  const [style, setStyle]           = useState('hard techno schranz industrial');
  const [aiTarget, setAiTarget]     = useState<'A'|'B'>('A');
  const [streamingA, setStreamingA] = useState(false);
  const [streamingB, setStreamingB] = useState(false);
  const [session, setSession]       = useState<Session | null>(null);

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const autoAbort   = useRef<AbortController | null>(null);
  const styleRef    = useRef(style);
  const isRunRef    = useRef(isRunning);
  // Refs al código vivo de cada track (para coherencia entre ellos)
  const codeA       = useRef(trackA);
  const codeB       = useRef(trackB);
  const sessionRef  = useRef<Session | null>(session);

  // Mantener las refs sincronizadas tras cada render (sin escribirlas en render)
  useEffect(() => {
    styleRef.current   = style;
    isRunRef.current   = isRunning;
    codeA.current      = trackA;
    codeB.current      = trackB;
    sessionRef.current = session;
  });

  useEffect(() => {
    if (canvasRef.current) initVisualEngine(canvasRef.current);
  }, []);

  // ── Streaming de IA a un track ──────────────────────────────────────────
  // Si `dir` viene, el Director gobierna (sesión coherente + autónomo).
  // Si no, es petición manual libre con `prompt`.
  interface GenOpts {
    sess?: Session;
    role?: TrackRole;
    guidance?: string;
    prompt?: string;
  }
  const streamToTrack = useCallback(async (
    trackId: 'A' | 'B',
    opts: GenOpts,
    signal?: AbortSignal
  ): Promise<void> => {
    const setCode    = trackId === 'A' ? setTrackA : setTrackB;
    const setLoading = trackId === 'A' ? setStreamingA : setStreamingB;

    const directive = opts.sess && opts.role ? buildDirective(opts.sess, opts.role) : undefined;
    const otherTrackCode = trackId === 'A' ? codeB.current : codeA.current;
    const previousCode   = trackId === 'A' ? codeA.current : codeB.current;

    setLoading(true);
    setCode(`// [IA generando Track ${trackId}...]`);

    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: opts.prompt ?? '',
          currentEditorState: '',
          directive,
          otherTrackCode,
          previousCode,
          guidance: opts.guidance,
        }),
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

  // ── Loop autónomo dirigido por el Director ─────────────────────────────────
  // Hace una sesión completa solo: fija género/BPM/tonalidad, arranca ambos
  // tracks coherentes y va avanzando la fase del set (intro→build→peak→break),
  // regenerando un track cada AUTO_INTERVAL en coherencia con lo que suena.
  const runAutoLoop = useCallback(async (signal: AbortSignal) => {
    // 1) El Director abre la sesión a partir del estilo (o el default)
    let sess = startSession(styleRef.current);
    setSession(sess);
    setSessionTempo(sess.bpm);

    // 2) Arranca los dos tracks coherentes en paralelo
    await Promise.all([
      streamToTrack('A', { sess, role: 'drums' }, signal),
      streamToTrack('B', { sess, role: 'bassMelody' }, signal),
    ]);

    // 3) Loop: avanza la fase del set y regenera un track alternando
    while (!signal.aborted && isRunRef.current) {
      await sleep(AUTO_INTERVAL);
      if (signal.aborted) break;

      sess = advanceSession(sess);
      setSession(sess);

      const track: 'A' | 'B' = sess.generation % 2 === 0 ? 'A' : 'B';
      const role: TrackRole  = track === 'A' ? 'drums' : 'bassMelody';
      await streamToTrack(track, { sess, role }, signal);
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
      // Abre una sesión por defecto para que el tempo y la tonalidad estén
      // fijados desde el principio (los tracks ya no fijan tempo ellos mismos).
      const sess = startSession(styleRef.current || style);
      setSession(sess);
      setSessionTempo(sess.bpm);
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
          {session && (
            <div className="session-readout">
              <span className="ses-genre">{session.genre.name}</span>
              <span className="ses-chip">{session.bpm} BPM</span>
              <span className="ses-chip">{session.root}:{session.scale}</span>
              <span className={`ses-phase ses-${session.phase}`}>● {session.phase}</span>
            </div>
          )}
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

          <select
            className="ai-style-input"
            value={style}
            onChange={e => setStyle(e.target.value)}
            disabled={!isRunning}
            title="Género de la sesión (conocimiento estilo Beatport)"
          >
            {GENRES.map(g => (
              <option key={g.id} value={g.match[0]}>
                {g.name} · {g.bpm.default} BPM
              </option>
            ))}
          </select>

          <input
            type="text"
            className="ai-prompt-input"
            placeholder={`Indicación manual → Track ${aiTarget}  (Enter) · opcional`}
            disabled={!isRunning || streamingA || streamingB}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const sess = sessionRef.current ?? startSession(styleRef.current);
                if (!sessionRef.current) { setSession(sess); setSessionTempo(sess.bpm); }
                streamToTrack(aiTarget, {
                  sess,
                  role: aiTarget === 'A' ? 'drums' : 'bassMelody',
                  guidance: e.currentTarget.value || undefined,
                });
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
