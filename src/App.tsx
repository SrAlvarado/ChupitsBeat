import { useState, useRef, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, keymap } from '@codemirror/view';
import './App.css';
import { initVisualEngine, initAudioEngine, evaluateCode, clearTrack, stopEngines, setSessionTempo, applyVisual, awaitNextPhrase } from './audioVisualEngine';
import {
  GENRES, startSession, advanceSession, buildDirective, specToCode,
  type Session, type TrackRole, type TrackSpec, type Phase,
} from './musicKnowledge';

const FUNCTION_URL = 'https://onocaxrqornukldmloyv.supabase.co/functions/v1/chupits-ai';
const PHRASE_CYCLES = 8; // frase musical: regenera cada 8 ciclos (sincronía por compás)

// Intensidad visual base por fase del set (el FFT del audio modula el resto).
const PHASE_INTENSITY: Record<Phase, number> = {
  intro: 0.2, build: 0.5, peak: 0.95, breakdown: 0.4,
};
const applySessionVisual = (s: Session) => applyVisual(s.genre.id, PHASE_INTENSITY[s.phase]);

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
    if (!directive) return; // la sesión siempre está dirigida por el Director
    const otherTrackCode = trackId === 'A' ? codeB.current : codeA.current;
    const previousCode   = trackId === 'A' ? codeA.current : codeB.current;

    setLoading(true);
    setCode(`// [IA generando Track ${trackId}…]`);

    // La IA devuelve JSON; el cliente lo valida y ensambla a Strudel seguro.
    const callAI = async (repair?: { spec: unknown; error: string }) => {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directive, otherTrackCode, previousCode,
          guidance: opts.guidance, prompt: opts.prompt ?? '', repair,
        }),
        signal,
      });
      if (!res.ok) throw new Error(`Error IA ${res.status}`);
      return res.json() as Promise<{ spec?: TrackSpec; error?: string; raw?: string }>;
    };

    // Ensambla el JSON → código Strudel; '' si la validación lo rechaza.
    let lastErr = '';
    const assemble = (spec?: TrackSpec): string => {
      if (!spec) return '';
      try { return specToCode(spec, directive); }
      catch (e) { lastErr = (e as Error).message; return ''; }
    };

    try {
      let json = await callAI();
      let code = assemble(json.spec);

      // Auto-corrección: si el JSON es inválido o no ensambla, reenvía a la IA
      // el spec infractor + el error para que devuelva una versión corregida.
      if (!code && !signal?.aborted) {
        console.warn(`[IA Track ${trackId}] inválido (${json.error || lastErr}); pidiendo auto-corrección…`);
        json = await callAI({ spec: json.spec ?? json.raw ?? null, error: json.error || lastErr || 'JSON no válido' });
        code = assemble(json.spec);
      }

      if (signal?.aborted) return;

      if (code) {
        setCode(code);
        evaluateCode(code, trackId);
      } else {
        console.warn(`[IA Track ${trackId}] sigue inválido tras auto-corrección; patrón anterior intacto`);
        setCode(`// ⚠️ IA no devolvió un patrón válido — se mantiene el anterior\n${previousCode}`);
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        console.error(`[IA Track ${trackId}]`, err);
        setCode(`// Error IA en Track ${trackId}\n${previousCode}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Loop autónomo dirigido por el Director ─────────────────────────────────
  // Hace una sesión completa solo: fija género/BPM/tonalidad, arranca ambos
  // tracks coherentes y va avanzando la fase del set (intro→build→peak→break),
  // regenerando un track en cada frontera de frase, coherente con lo que suena.
  const runAutoLoop = useCallback(async (signal: AbortSignal) => {
    // 1) El Director abre la sesión a partir del estilo (o el default)
    let sess = startSession(styleRef.current);
    setSession(sess);
    setSessionTempo(sess.bpm);
    applySessionVisual(sess);

    // 2) Arranca los dos tracks coherentes en paralelo
    await Promise.all([
      streamToTrack('A', { sess, role: 'drums' }, signal),
      streamToTrack('B', { sess, role: 'bassMelody' }, signal),
    ]);

    // 3) Loop: en cada frontera de frase avanza la fase y regenera un track
    //    alternando, sincronizado con el reloj de Strudel (no un sleep fijo).
    while (!signal.aborted && isRunRef.current) {
      await awaitNextPhrase(PHRASE_CYCLES, signal);
      if (signal.aborted) break;

      sess = advanceSession(sess);
      setSession(sess);
      applySessionVisual(sess);

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
      applySessionVisual(sess);
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
