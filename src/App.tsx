import { useState, useRef, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, keymap } from '@codemirror/view';
import './App.css';
import {
  initVisualEngine, initAudioEngine, evaluateCode, clearTrack, stopEngines,
  setSessionTempo, setSessionEnergy, applyVisual, awaitNextPhrase,
} from './audioVisualEngine';
import {
  GENRES, TRACKS, DEFAULT_TRACK_CODE, PHASE_ACTIVE, startSession, advanceSession, buildDirective, specToCode,
  type Session, type TrackRole, type TrackSpec, type Phase,
} from './musicKnowledge';

const FUNCTION_URL = 'https://onocaxrqornukldmloyv.supabase.co/functions/v1/chupits-ai';
const PHRASE_CYCLES = 8; // cada cuántos compases avanza la fase / cambia el arreglo

const PHASE_INTENSITY: Record<Phase, number> = { intro: 0.2, build: 0.5, peak: 0.95, breakdown: 0.4 };

// Aplica tempo + energía + visual de la sesión de una vez.
function applySession(s: Session) {
  setSessionTempo(s.bpm);
  setSessionEnergy(s.phase);
  applyVisual(s.genre.id, PHASE_INTENSITY[s.phase]);
}

export default function App() {
  const [codes, setCodes]     = useState<Record<TrackRole, string>>(() => ({ ...DEFAULT_TRACK_CODE }));
  const [streaming, setStream]= useState<Partial<Record<TrackRole, boolean>>>({});
  const [locked, setLocked]   = useState<Partial<Record<TrackRole, boolean>>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [isAuto, setIsAuto]       = useState(false);
  const [style, setStyle]         = useState('hard techno schranz industrial');
  const [aiTarget, setAiTarget]   = useState<TrackRole>('kick');
  const [session, setSession]     = useState<Session | null>(null);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const autoAbort  = useRef<AbortController | null>(null);
  const styleRef   = useRef(style);
  const isRunRef   = useRef(isRunning);
  const codesRef   = useRef(codes);
  const lockedRef  = useRef(locked);
  const sessionRef = useRef<Session | null>(session);
  const rateLimitUntil = useRef(0); // back-off cuando Groq corta por cuota

  useEffect(() => {
    styleRef.current = style;
    isRunRef.current = isRunning;
    codesRef.current = codes;
    lockedRef.current = locked;
    sessionRef.current = session;
  });

  useEffect(() => { if (canvasRef.current) initVisualEngine(canvasRef.current); }, []);

  const setTrackCode = useCallback((role: TrackRole, value: string | ((p: string) => string)) => {
    setCodes(prev => ({ ...prev, [role]: typeof value === 'function' ? value(prev[role]) : value }));
  }, []);

  // ── Generación de IA para UNA pista ──────────────────────────────────────
  interface GenOpts { sess: Session; role: TrackRole; guidance?: string; prompt?: string; align?: boolean; }

  const streamToTrack = useCallback(async (role: TrackRole, opts: GenOpts, signal?: AbortSignal): Promise<void> => {
    // Back-off si Groq nos cortó por cuota: no martillear la API.
    if (Date.now() < rateLimitUntil.current) {
      const s = Math.ceil((rateLimitUntil.current - Date.now()) / 1000);
      setTrackCode(role, `// ⏳ Cuota de Groq en pausa — reintenta en ~${s}s\n${codesRef.current[role]}`);
      return;
    }
    const directive = buildDirective(opts.sess, role);
    // Coherencia con tokens mínimos: solo los anclajes (kick + bass), no las 6.
    const otherTrackCode = (['kick', 'bass'] as TrackRole[])
      .filter(r => r !== role)
      .map(r => `[${r.toUpperCase()}] ${codesRef.current[r]}`).join('\n');
    const previousCode = codesRef.current[role];

    setStream(s => ({ ...s, [role]: true }));
    setTrackCode(role, `// [IA generando ${role.toUpperCase()}…]`);

    const callAI = async (repair?: { spec: unknown; error: string }) => {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 25000);
      const onAbort = () => ctrl.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        const res = await fetch(FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ directive, otherTrackCode, previousCode, guidance: opts.guidance, prompt: opts.prompt ?? '', repair }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Error IA ${res.status}`);
        return await res.json() as { spec?: TrackSpec; error?: string; raw?: string; rateLimited?: boolean; retryAfter?: string };
      } finally {
        clearTimeout(to);
        signal?.removeEventListener('abort', onAbort);
      }
    };

    let lastErr = '';
    const assemble = (spec?: TrackSpec): string => {
      if (!spec) return '';
      try { return specToCode(spec, directive); } catch (e) { lastErr = (e as Error).message; return ''; }
    };

    // Maneja respuesta de rate-limit: activa cooldown y avisa, sin reintentar.
    const handledRateLimit = (j: { rateLimited?: boolean; retryAfter?: string }): boolean => {
      if (!j?.rateLimited) return false;
      const secs = parseInt(j.retryAfter || '', 10);
      rateLimitUntil.current = Date.now() + (isFinite(secs) && secs > 0 ? secs * 1000 : 90000);
      setTrackCode(role, `// ⏳ Límite diario de Groq alcanzado.\n// Pausa la IA o usa otra clave/tier. ${previousCode}`);
      return true;
    };

    try {
      let json = await callAI();
      if (handledRateLimit(json)) return;
      let code = assemble(json.spec);
      if (!code && !signal?.aborted) {
        console.warn(`[IA ${role}] inválido (${json.error || lastErr}); auto-corrección…`);
        json = await callAI({ spec: json.spec ?? json.raw ?? null, error: json.error || lastErr || 'JSON no válido' });
        if (handledRateLimit(json)) return;
        code = assemble(json.spec);
      }
      if (signal?.aborted) return;
      if (code) {
        if (opts.align) { await awaitNextPhrase(1, signal); if (signal?.aborted) return; }
        setTrackCode(role, code);
        evaluateCode(code, role);
      } else {
        console.warn(`[IA ${role}] sigue inválido; patrón anterior intacto`);
        setTrackCode(role, `// ⚠️ IA no devolvió patrón válido — se mantiene el anterior\n${previousCode}`);
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

  // ── Loop autónomo (Director) ───────────────────────────────────────────────
  const silence = useCallback((role: TrackRole) => {
    clearTrack(role);
    setTrackCode(role, `// (${role.toUpperCase()} en silencio en esta fase)`);
  }, [setTrackCode]);

  const runAutoLoop = useCallback(async (signal: AbortSignal) => {
    let sess = startSession(styleRef.current);
    setSession(sess);
    applySession(sess);

    const live = new Set<TrackRole>();
    for (const role of PHASE_ACTIVE[sess.phase]) {
      if (signal.aborted) return;
      await streamToTrack(role, { sess, role }, signal);
      live.add(role);
    }

    while (!signal.aborted && isRunRef.current) {
      await awaitNextPhrase(PHRASE_CYCLES, signal);
      if (signal.aborted) break;

      sess = advanceSession(sess);
      setSession(sess);
      applySession(sess);
      const active = PHASE_ACTIVE[sess.phase];
      const lk = lockedRef.current;

      // 1) Silencia las que SALEN del arreglo (salvo las bloqueadas 🔒).
      for (const role of [...live]) {
        if (!active.includes(role) && !lk[role]) { silence(role); live.delete(role); }
      }
      // 2) Activa (genera) las que ENTRAN nuevas (salvo bloqueadas).
      for (const role of active) {
        if (signal.aborted) break;
        if (!live.has(role) && !lk[role]) {
          await streamToTrack(role, { sess, role, align: true }, signal);
          live.add(role);
        }
      }
      // 3) Varía UNA pista activa NO bloqueada (rotación) para evolucionar.
      if (!signal.aborted) {
        const candidates = active.filter(r => !lk[r]);
        if (candidates.length) {
          const role = candidates[sess.generation % candidates.length];
          await streamToTrack(role, { sess, role, align: true }, signal);
        }
      }
    }
  }, [streamToTrack, silence]);

  const startAuto = useCallback(() => {
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

  // ── Feedback del usuario (steering) ────────────────────────────────────────
  const toggleLock = useCallback((role: TrackRole) => {
    setLocked(prev => ({ ...prev, [role]: !prev[role] }));
  }, []);

  // Regenerar YA una pista (manual, funcione o no el modo Auto).
  const regenerate = useCallback((role: TrackRole) => {
    let sess = sessionRef.current;
    if (!sess) { sess = startSession(styleRef.current); setSession(sess); applySession(sess); }
    streamToTrack(role, { sess, role, align: isRunRef.current });
  }, [streamToTrack]);

  // ── Transporte ─────────────────────────────────────────────────────────────
  const handleStart = async () => {
    try {
      await initAudioEngine();
      const sess = startSession(styleRef.current || style);
      setSession(sess);
      applySession(sess);
      setIsRunning(true);
    } catch (err) { console.error('Error al iniciar:', err); }
  };

  const handleStop = () => { stopAuto(); stopEngines(); setIsRunning(false); };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <canvas id="chupits-bg-canvas" ref={canvasRef} className="hydra-canvas" />

      <div className="ui-layer">
        <header className="header">
          <div className="brand">
            <h1>CHUPITS<span>BEAT</span></h1>
            {session && (
              <div className="session-readout">
                <span className="ses-genre">{session.genre.name}</span>
                <span className="ses-chip">{session.bpm} BPM</span>
                <span className="ses-chip">{session.root}:{session.scale}</span>
                <span className={`ses-phase ses-${session.phase}`}>● {session.phase}</span>
              </div>
            )}
          </div>
          <div className="controls">
            <select className="genre-select" value={style} onChange={e => setStyle(e.target.value)} disabled={isRunning}
              title="Género de la sesión">
              {GENRES.map(g => <option key={g.id} value={g.match[0]}>{g.name} · {g.bpm.default} BPM</option>)}
            </select>
            <button onClick={handleStart} disabled={isRunning} className="btn-start">▶ Empezar</button>
            <button onClick={isAuto ? stopAuto : startAuto} disabled={!isRunning} className={isAuto ? 'btn-auto-on' : 'btn-auto'}>
              {isAuto ? '⏹ Auto ON' : '🤖 Auto'}
            </button>
            <button onClick={handleStop} disabled={!isRunning} className="btn-stop">■ Parar</button>
          </div>
        </header>

        <main className="editors-grid">
          {TRACKS.map(t => (
            <TrackCard
              key={t.id}
              id={t.id}
              label={t.label}
              code={codes[t.id]}
              onChange={v => setTrackCode(t.id, v)}
              onEval={() => evaluateCode(codesRef.current[t.id], t.id)}
              onClear={() => clearTrack(t.id)}
              onRegen={() => regenerate(t.id)}
              onLock={() => toggleLock(t.id)}
              isRunning={isRunning}
              isStreaming={!!streaming[t.id]}
              isLocked={!!locked[t.id]}
              selected={aiTarget === t.id}
              onSelect={() => setAiTarget(t.id)}
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

        <footer className="ai-copilot-section">
          <span className="footer-label">IA → <b>{aiTarget.toUpperCase()}</b></span>
          <input
            type="text"
            className="ai-prompt-input"
            placeholder={`Indicación manual para ${aiTarget.toUpperCase()} (Enter)…`}
            disabled={!isRunning}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                let sess = sessionRef.current;
                if (!sess) { sess = startSession(styleRef.current); setSession(sess); applySession(sess); }
                streamToTrack(aiTarget, { sess, role: aiTarget, guidance: e.currentTarget.value || undefined, align: isRunRef.current });
                e.currentTarget.value = '';
              }
            }}
          />
          <span className="footer-hint">Clic en una pista para apuntarla · 🔒 mantener · 🔄 regenerar</span>
        </footer>
      </div>
    </div>
  );
}

// ── Sub-componente TrackCard ─────────────────────────────────────────────────
interface TrackCardProps {
  id: TrackRole;
  label: string;
  code: string;
  onChange: (v: string) => void;
  onEval: () => void;
  onClear: () => void;
  onRegen: () => void;
  onLock: () => void;
  onSelect: () => void;
  isRunning: boolean;
  isStreaming: boolean;
  isLocked: boolean;
  selected: boolean;
  extensions: unknown[];
}

function TrackCard({ id, label, code, onChange, onEval, onClear, onRegen, onLock, onSelect, isRunning, isStreaming, isLocked, selected, extensions }: TrackCardProps) {
  const cls = ['track-panel', `track-${id}`,
    isStreaming ? 'track-streaming' : '', isLocked ? 'track-locked' : '', selected ? 'track-selected' : ''].join(' ');
  return (
    <div className={cls}>
      <div className="track-header" onClick={onSelect}>
        <span className={`track-label track-${id}-label`}>
          {isStreaming ? '⟳ ' : isLocked ? '🔒 ' : '▶ '}{label}
        </span>
        <div className="track-controls">
          <button onClick={e => { e.stopPropagation(); onRegen(); }} disabled={!isRunning} className="btn-regen" title="Regenerar ya">🔄</button>
          <button onClick={e => { e.stopPropagation(); onLock(); }} disabled={!isRunning} className={`btn-lock ${isLocked ? 'on' : ''}`} title="Mantener (no regenerar)">{isLocked ? '🔒' : '🔓'}</button>
          <button onClick={e => { e.stopPropagation(); onEval(); }} disabled={!isRunning} className="btn-eval" title="Evaluar">▶</button>
          <button onClick={e => { e.stopPropagation(); onClear(); }} disabled={!isRunning} className="btn-clear" title="Silenciar">✕</button>
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
