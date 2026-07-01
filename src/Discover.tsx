import { useCallback, useRef, useState, type CSSProperties } from 'react';
import './remix.css';

const BACKEND = 'http://localhost:8000';

interface Rec {
  name: string;
  provider_id: string;
  popularity: number;
  listeners: number | null;
  picture: string | null;
  link: string | null;
  preview: string | null;
  compatibility: number;
  reasons: string[];
  audio: { bpm?: number; key?: string; energy?: number; brightness?: number };
}
interface DiscoverResult {
  seeds: string[];
  taste?: { bpm?: number; key?: string; energy?: number; brightness?: number };
  popularity_source?: string;
  candidates_found?: number;
  analyzed?: number;
  recommendations: Rec[];
  error?: string;
}

const PRESETS = ['Charlotte de Witte', 'Amelie Lens', 'I Hate Models', 'Pet Duo'];

export default function Discover() {
  const [seeds, setSeeds] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [maxListeners, setMaxListeners] = useState(50000);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const addSeed = useCallback((name: string) => {
    const n = name.trim();
    if (!n) return;
    setSeeds(s => (s.some(x => x.toLowerCase() === n.toLowerCase()) ? s : [...s, n]));
    setDraft('');
  }, []);
  const removeSeed = (name: string) => setSeeds(s => s.filter(x => x !== name));

  const discover = useCallback(async () => {
    if (!seeds.length) return;
    setBusy(true); setError(''); setResult(null);
    setNote('Analizando el sonido de tus favoritos y rastreando emergentes…');
    try {
      const r = await fetch(`${BACKEND}/discover`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seeds, max_listeners: maxListeners, results: 12, analyze_top: 18 }),
      });
      if (!r.ok) throw new Error(`discover: ${r.status}`);
      const j: DiscoverResult = await r.json();
      if (j.error) { setError(j.error); }
      setResult(j);
    } catch (e) {
      setError(`${(e as Error).message}. ¿Está el backend en localhost:8000?`);
    } finally {
      setBusy(false); setNote('');
    }
  }, [seeds, maxListeners]);

  // Reproduce el preview (URL de Deezer que ya viene del backend). El <audio>
  // reproduce cross-origin sin problema; el fetch directo a la API de Deezer
  // no, porque no manda cabeceras CORS.
  const togglePreview = useCallback(async (rec: Rec) => {
    if (playing === rec.provider_id) {
      audioRef.current?.pause(); setPlaying(null); return;
    }
    if (!rec.preview) return;
    try {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.pause();
      audioRef.current.src = rec.preview;
      audioRef.current.onended = () => setPlaying(null);
      await audioRef.current.play();
      setPlaying(rec.provider_id);
    } catch { setPlaying(null); }
  }, [playing]);

  return (
    <div className="remix">
      <div className="remix-bg" />
      <div className="remix-inner">
        <header className="remix-hero">
          <h1>DIS<span>COVERY</span></h1>
          <p>Dinos tus artistas favoritos → analizamos su <b>sonido real</b> → te descubrimos artistas emergentes que suenan parecido.</p>
        </header>

        {/* Entrada de artistas favoritos */}
        <div className="drop-zone">
          <div className="seed-tags">
            {seeds.map(s => (
              <span key={s} className="seed-tag">
                {s}<button onClick={() => removeSeed(s)} aria-label="quitar">×</button>
              </span>
            ))}
            <input
              className="seed-input"
              placeholder={seeds.length ? 'añade otro…' : 'Escribe un artista y pulsa Enter'}
              value={draft}
              disabled={busy}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addSeed(draft);
                if (e.key === 'Backspace' && !draft && seeds.length) removeSeed(seeds[seeds.length - 1]);
              }}
            />
          </div>
          {!seeds.length && (
            <div className="presets">
              <span className="muted">prueba:</span>
              {PRESETS.map(p => (
                <button key={p} className="preset-chip" onClick={() => addSeed(p)}>{p}</button>
              ))}
            </div>
          )}
          <label className="bpm-slider emerging">
            Máx. oyentes mensuales en Spotify (más bajo = más emergente) <b>{maxListeners.toLocaleString()}</b>
            <input type="range" min={1000} max={500000} step={1000} value={maxListeners}
              onChange={e => setMaxListeners(Number(e.target.value))} />
          </label>
          <button className="btn-remix wide" onClick={discover} disabled={busy || !seeds.length}>
            {busy ? '… analizando' : '🔭 Descubrir emergentes'}
          </button>
        </div>

        {note && <div className="status">{note}</div>}
        {error && <div className="status err">{error}</div>}

        {/* Resultados */}
        {result && result.recommendations.length > 0 && (
          <div className="results">
            {result.taste && (
              <div className="analysis-card">
                <h3>Tu huella de gusto · {result.seeds.join(' + ')}</h3>
                <div className="chips">
                  <div className="chip"><span>{result.taste.bpm ?? '—'}</span>BPM medio</div>
                  <div className="chip"><span>{result.taste.key ?? '—'}</span>Tonalidad</div>
                  <div className="chip"><span>{Math.round((result.taste.energy ?? 0) * 100)}</span>Energía</div>
                  <div className="chip"><span>{Math.round((result.taste.brightness ?? 0) * 100)}</span>Brillo</div>
                </div>
                <p className="muted">{result.candidates_found} candidatos rastreados · {result.analyzed} analizados acústicamente</p>
              </div>
            )}

            <div className="rec-grid">
              {result.recommendations.map(rec => (
                <div key={rec.provider_id} className="rec-card">
                  <div className="rec-score" style={{ '--p': rec.compatibility } as CSSProperties}>
                    <span>{rec.compatibility}<small>%</small></span>
                  </div>
                  <div className="rec-body">
                    <div className="rec-head">
                      {rec.picture && <img src={rec.picture} alt="" className="rec-pic" />}
                      <div>
                        <div className="rec-name">{rec.name}</div>
                        <div className="rec-meta">
                          {rec.listeners != null ? `${rec.listeners.toLocaleString()} oyentes/mes` : `${rec.popularity.toLocaleString()} fans`} · {rec.audio.bpm}bpm · {rec.audio.key}
                        </div>
                      </div>
                    </div>
                    <div className="rec-reasons">
                      {rec.reasons.map((r, i) => <span key={i} className="reason">✓ {r}</span>)}
                    </div>
                    <div className="rec-actions">
                      <button className={`btn-mini ${playing === rec.provider_id ? 'on' : ''}`}
                        disabled={!rec.preview} onClick={() => togglePreview(rec)}>
                        {playing === rec.provider_id ? '⏸ Pausa' : '▶ Escuchar'}
                      </button>
                      {rec.link && <a className="btn-mini ghost" href={rec.link} target="_blank" rel="noreferrer">Abrir ↗</a>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result && result.recommendations.length === 0 && !error && (
          <div className="status">No encontré emergentes con ese filtro. Sube el límite de popularidad o prueba otros artistas.</div>
        )}
      </div>
    </div>
  );
}
