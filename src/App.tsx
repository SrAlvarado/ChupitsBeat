import { useState, useRef, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, keymap } from '@codemirror/view';
import './App.css';
import { initVisualEngine, initAudioEngine, evaluateCode, clearTrack, stopEngines, setSessionTempo, applyVisual, awaitNextPhrase } from './audioVisualEngine';
import {
  GENRES, TRACKS, DEFAULT_TRACK_CODE, startSession, advanceSession, buildDirective, specToCode,
  type Session, type TrackRole, type TrackSpec, type Phase,
} from './musicKnowledge';

const FUNCTION_URL = 'https://onocaxrqornukldmloyv.supabase.co/functions/v1/chupits-ai';
const PHRASE_CYCLES = 10; // frase musical: regenera cada 10 compases (un poco más ágil)

// Intensidad visual base por fase del set (el FFT del audio modula el resto).
const PHASE_INTENSITY: Record<Phase, number> = {
  intro: 0.2, build: 0.5, peak: 0.95, breakdown: 0.4,
};
const applySessionVisual = (s: Session) => applyVisual(s.genre.id, PHASE_INTENSITY[s.phase]);

// Olas de arranque: primero el esqueleto del groove, luego las capas de color.
// Así repartimos las llamadas a la IA y evitamos un pico de rate-limit.
const START_WAVES: TrackRole[][] = [
  ['kick', 'bass', 'hats'],
  ['perc', 'stab', 'atmo'],
];

export default function App() {
  const [codes, setCodes]     = useState<Record<TrackRole, string>>(() => ({ ...DEFAULT_TRACK_CODE }));
  const [streaming, setStream]= useState<Partial<Record<TrackRole, boolean>>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [isAuto, setIsAuto]       = useState(false);
  const [style, setStyle]         = useState('hard techno schranz industrial');
  const [aiTarget, setAiTarget]   = useState<TrackRole>('kick');
  const [session, setSession]     = useState<Session | null>(null);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const autoAbort  = useRef<AbortController | null>(null);
  const styleRef   = useRef(style);
  const isRunRef   = useRef(isRunning);
  const codesRef   = useRef(codes);           // código vivo de cada pista (coherencia)
  const sessionRef = useRef<Session | null>(session);

  // Mantener las refs sincronizadas tras cada render (sin escribirlas en render)
  useEffect(() => {
    styleRef.current   = style;
    isRunRef.current   = isRunning;
    codesRef.current   = codes;
    sessionRef.current = session;
  });

  useEffect(() => {
    if (canvasRef.current) initVisualEngine(canvasRef.current);
  }, []);

  const setTrackCode = useCallback((role: TrackRole, value: string | ((p: string) => string)) => {
    setCodes(prev => ({ ...prev, [role]: typeof value === 'function' ? value(prev[role]) : value }));
  }, []);

  // ── Generación de IA para UNA pista (un elemento del track) ──────────────
  interface GenOpts { sess: Session; role: TrackRole; guidance?: string; prompt?: string; }

  const streamToTrack = useCallback(async (
    role: TrackRole,
    opts: GenOpts,
    signal?: AbortSignal
  ): Promise<void> => {
    const directive = buildDirective(opts.sess, role);
    // Coherencia: enviamos lo que tocan TODAS las demás pistas ahora mismo.
    const otherTrackCode = TRACKS
      .filter(t => t.id !== role)
      .map(t => `[${t.label}] ${codesRef.current[t.id]}`)
      .join('\n');
    const previousCode = codesRef.current[role];

    setStream(s => ({ ...s, [role]: true }));
    setTrackCode(role, `// [IA generando ${role.toUpperCase()}…]`);

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

    let lastErr = '';
    const assemble = (spec?: TrackSpec): string => {
      if (!spec) return '';
      try { return specToCode(spec, directive); }
      catch (e) { lastErr = (e as Error).message; return ''; }
    };

    try {
      let json = await callAI();
      let code = assemble(json.spec);

      // Auto-corrección: reenvía el spec infractor + el error para 1 reintento.
      if (!code && !signal?.aborted) {
        console.warn(`[IA ${role}] inválido (${json.error || lastErr}); pidiendo auto-corrección…`);
        json = await callAI({ spec: json.spec ?? json.raw ?? null, error: json.error || lastErr || 'JSON no válido' });
        code = assemble(json.spec);
      }

      if (signal?.aborted) return;

      if (code) {
        setTrackCode(role, code);
        evaluateCode(code, role);
      } else {
        console.warn(`[IA ${role}] sigue inválido tras auto-corrección; patrón anterior intacto`);
        setTrackCode(role, `// ⚠️ IA no devolvió un patrón válido — se mantiene el anterior\n${previousCode}`);
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        console.error(`[IA ${role}]`, err);
        setTrackCode(role, `// Error IA en ${role.toUpperCase()}\n${previousCode}`);
      }
    } finally {
      setStream(s => ({ ...s, [role]: false }));
    }
  }, [setTrackCode]);

  // ── Loop autónomo dirigido por el Director ─────────────────────────────────
  // Arranca todas las pistas (en olas), luego va regenerando UNA por frase,
  // ciclando por todos los elementos, sincronizado con el reloj de Strudel.
  const runAutoLoop = useCallback(async (signal: AbortSignal) => {
    let sess = startSession(styleRef.current);
    setSession(sess);
    setSessionTempo(sess.bpm);
    applySessionVisual(sess);

    // Arranque por olas (groove primero, color después)
    for (const wave of START_WAVES) {
      if (signal.aborted) return;
      await Promise.all(wave.map(role => streamToTrack(role, { sess, role }, signal)));
    }

    while (!signal.aborted && isRunRef.current) {
      await awaitNextPhrase(PHRASE_CYCLES, signal);
      if (signal.aborted) break;

      sess = advanceSession(sess);
      setSession(sess);
      applySessionVisual(sess);

      // Regenera el elemento que toca en el ciclo (rota por todas las pistas).
      const role = TRACKS[sess.generation % TRACKS.length].id;
      await streamToTrack(role, { sess, role }, signal);
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <canvas id="chupits-bg-canvas" ref={canvasRef} className="hydra-canvas" />

      <div className="ui-layer">
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

        {/* Una pista por elemento (kick, hats, perc, bass, stab, atmo) */}
        <main className="editors-grid">
          {TRACKS.map(t => (
            <TrackPanel
              key={t.id}
              id={t.id}
              label={t.label}
              code={codes[t.id]}
              onChange={v => setTrackCode(t.id, v)}
              onEval={() => evaluateCode(codesRef.current[t.id], t.id)}
              onClear={() => clearTrack(t.id)}
              isRunning={isRunning}
              isStreaming={!!streaming[t.id]}
              extensions={[
                javascript(),
                EditorView.lineWrapping,
                keymap.of([
                  { key: 'Ctrl-Enter', run: () => { if (isRunning) evaluateCode(codesRef.current[t.id], t.id); return true; } },
                  { key: 'Mod-Enter',  run: () => { if (isRunning) evaluateCode(codesRef.current[t.id], t.id); return true; } },
                ]),
              ]}
            />
          ))}
        </main>

        {/* Footer IA */}
        <footer className="ai-copilot-section">
          <div className="ai-track-selector">
            {TRACKS.map(t => (
              <button
                key={t.id}
                className={`ai-track-btn ${aiTarget === t.id ? 'active-a' : ''}`}
                onClick={() => setAiTarget(t.id)}
              >IA→{t.label}</button>
            ))}
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
            placeholder={`Indicación manual → ${aiTarget.toUpperCase()}  (Enter) · opcional`}
            disabled={!isRunning}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const sess = sessionRef.current ?? startSession(styleRef.current);
                if (!sessionRef.current) { setSession(sess); setSessionTempo(sess.bpm); applySessionVisual(sess); }
                streamToTrack(aiTarget, { sess, role: aiTarget, guidance: e.currentTarget.value || undefined });
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
  id: TrackRole;
  label: string;
  code: string;
  onChange: (v: string) => void;
  onEval: () => void;
  onClear: () => void;
  isRunning: boolean;
  isStreaming: boolean;
  extensions: unknown[];
}

function TrackPanel({ id, label, code, onChange, onEval, onClear, isRunning, isStreaming, extensions }: TrackPanelProps) {
  return (
    <div className={`track-panel ${isStreaming ? 'track-streaming' : ''}`}>
      <div className="track-header">
        <span className={`track-label track-${id}-label`}>
          {isStreaming ? '⟳ ' : '▶ '}{label}
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
