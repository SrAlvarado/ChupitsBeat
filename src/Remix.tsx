import { useCallback, useRef, useState } from 'react';
import './remix.css';

const BACKEND = 'http://localhost:8000';

type Stage = 'idle' | 'extracting' | 'separating' | 'analyzing' | 'done' | 'error';
interface Stems { vocals?: string; drums?: string; bass?: string; other?: string }
interface Analysis { bpm?: number; key?: string; scale?: string }

const STEM_META: { id: keyof Stems; label: string; emoji: string }[] = [
  { id: 'vocals', label: 'Voz / Melodía', emoji: '🎤' },
  { id: 'drums',  label: 'Batería',       emoji: '🥁' },
  { id: 'bass',   label: 'Bajo',          emoji: '🎸' },
  { id: 'other',  label: 'Otros',         emoji: '🎹' },
];

// Análisis en el navegador con essentia.js (defensivo: si falla, no rompe nada).
async function analyze(sourceUrl: string): Promise<Analysis | null> {
  try {
    const ab = await (await fetch(BACKEND + sourceUrl)).arrayBuffer();
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    const buf = await ac.decodeAudioData(ab);
    ac.close?.();
    const sr = buf.sampleRate;
    const len = Math.min(buf.length, sr * 60); // hasta 60s para que sea ágil
    const ch0 = buf.getChannelData(0);
    const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
    const mono = new Float32Array(len);
    for (let i = 0; i < len; i++) mono[i] = ch1 ? (ch0[i] + ch1[i]) / 2 : ch0[i];

    // Importamos los builds ES directamente (el paquete principal es CJS/UMD y
    // rompe el import dinámico). El wasm ES trae el binario inline en base64.
    const coreMod = await import('essentia.js/dist/essentia.js-core.es.js') as unknown as {
      default: new (w: unknown) => {
        arrayToVector: (a: Float32Array) => unknown;
        PercivalBpmEstimator: (v: unknown) => { bpm: number };
        KeyExtractor: (v: unknown) => { key: string; scale: string };
        delete?: () => void;
      };
    };
    const wasmMod = await import('essentia.js/dist/essentia-wasm.es.js') as unknown as {
      EssentiaWASM?: unknown; default?: unknown;
    };
    let wasm: unknown = wasmMod.EssentiaWASM ?? wasmMod.default;
    if (typeof wasm === 'function') wasm = await (wasm as () => Promise<unknown>)();
    const Essentia = coreMod.default;
    const essentia = new Essentia(wasm);
    const vec = essentia.arrayToVector(mono);
    const out: Analysis = {};
    try { out.bpm = Math.round(essentia.PercivalBpmEstimator(vec).bpm); } catch (e) { console.warn('[bpm]', e); }
    try { const k = essentia.KeyExtractor(vec); out.key = k.key; out.scale = k.scale; } catch (e) { console.warn('[key]', e); }
    essentia.delete?.();
    return out;
  } catch (e) {
    console.warn('[analyze]', e);
    return null;
  }
}

export default function Remix() {
  const [stage, setStage] = useState<Stage>('idle');
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [stems, setStems] = useState<Stems>({});
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => { setStems({}); setAnalysis(null); setSource(null); };

  // Pipeline común tras obtener {job, source}.
  const process = useCallback(async (job: string, src: string) => {
    setSource(src);
    setStage('separating');
    setNote('Separando stems con Demucs… (puede tardar ~1 min)');
    const sres = await fetch(`${BACKEND}/stems`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job }),
    });
    if (!sres.ok) throw new Error(`stems: ${sres.status}`);
    const sjson = await sres.json();
    setStems(sjson.stems || {});

    setStage('analyzing');
    setNote('Analizando BPM y tonalidad…');
    setAnalysis(await analyze(src));

    setStage('done');
    setNote('');
  }, []);

  const fromUrl = useCallback(async () => {
    if (!url.trim()) return;
    reset();
    try {
      setStage('extracting');
      setNote('Descargando audio de la URL…');
      const r = await fetch(`${BACKEND}/extract`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!r.ok) throw new Error(`extract: ${r.status}`);
      const j = await r.json();
      await process(j.job, j.source);
    } catch (e) {
      setStage('error');
      setNote(`Error: ${(e as Error).message}. ¿Está el backend en localhost:8000?`);
    }
  }, [url, process]);

  const fromFile = useCallback(async (file: File) => {
    reset();
    try {
      setStage('extracting');
      setNote(`Cargando ${file.name}…`);
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${BACKEND}/upload`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error(`upload: ${r.status}`);
      const j = await r.json();
      await process(j.job, j.source);
    } catch (e) {
      setStage('error');
      setNote(`Error: ${(e as Error).message}. ¿Está el backend en localhost:8000?`);
    }
  }, [process]);

  const busy = stage === 'extracting' || stage === 'separating' || stage === 'analyzing';
  const steps: { key: Stage; label: string }[] = [
    { key: 'extracting', label: 'Cargar' },
    { key: 'separating', label: 'Stems' },
    { key: 'analyzing', label: 'Analizar' },
  ];
  const stageIdx = ['extracting', 'separating', 'analyzing', 'done'].indexOf(stage);

  return (
    <div className="remix">
      <div className="remix-bg" />
      <div className="remix-inner">
        <header className="remix-hero">
          <h1>REMIX<span>ENGINE</span></h1>
          <p>Pasa una canción → analizamos base, melodía y tonalidad → la remezclamos en <b>schranz</b>.</p>
        </header>

        {/* Zona de entrada */}
        <div
          className={`drop-zone ${dragging ? 'dragging' : ''} ${busy ? 'busy' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f && !busy) fromFile(f); }}
        >
          <div className="drop-row">
            <input
              className="url-input"
              placeholder="Pega una URL (YouTube…) y dale a Remix"
              value={url}
              disabled={busy}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fromUrl(); }}
            />
            <button className="btn-remix" onClick={fromUrl} disabled={busy || !url.trim()}>
              {busy ? '…' : '✨ Remix'}
            </button>
          </div>
          <div className="drop-or">o</div>
          <button className="btn-file" disabled={busy} onClick={() => fileInput.current?.click()}>
            ⬆️ Arrastra o sube un .mp3
          </button>
          <input ref={fileInput} type="file" accept="audio/*" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) fromFile(f); }} />
        </div>

        {/* Stepper */}
        {stage !== 'idle' && (
          <div className={`stepper ${stage === 'error' ? 'err' : ''}`}>
            {steps.map((s, i) => (
              <div key={s.key} className={`step ${i < stageIdx ? 'done' : ''} ${i === stageIdx ? 'active' : ''}`}>
                <span className="dot">{i < stageIdx ? '✓' : i + 1}</span>{s.label}
              </div>
            ))}
          </div>
        )}
        {note && <div className={`status ${stage === 'error' ? 'err' : ''}`}>{note}</div>}

        {/* Resultados */}
        {(stage === 'done' || Object.keys(stems).length > 0) && (
          <div className="results">
            <div className="analysis-card">
              <h3>Análisis</h3>
              <div className="chips">
                <div className="chip"><span>{analysis?.bpm ?? '—'}</span>BPM</div>
                <div className="chip"><span>{analysis?.key ?? '—'}</span>Tonalidad</div>
                <div className="chip"><span>{analysis?.scale ?? '—'}</span>Escala</div>
              </div>
              {!analysis && <p className="muted">Análisis no disponible (essentia.js) — los stems funcionan igual.</p>}
              {source && <audio className="player" controls src={BACKEND + source} />}
            </div>

            <div className="stems-grid">
              {STEM_META.map(m => {
                const u = stems[m.id];
                return (
                  <div key={m.id} className={`stem-card stem-${m.id} ${u ? '' : 'empty'}`}>
                    <div className="stem-head"><span className="stem-emoji">{m.emoji}</span>{m.label}</div>
                    {u ? <audio className="player" controls src={BACKEND + u} /> : <span className="muted">—</span>}
                  </div>
                );
              })}
            </div>

            <button className="btn-generate" disabled title="Próxima fase">
              🔥 Generar base de schranz + remix (Fase 3)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
