import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { forceCollide } from 'd3-force';
import { toPng } from 'html-to-image';
import * as faceapi from '@vladmandic/face-api';
import './remix.css';

// carga (una vez) los modelos de detección de cara
let faceModelsP: Promise<void> | null = null;
function loadFaceModels() {
  if (!faceModelsP) {
    faceModelsP = (async () => {
      // inicializar backend de TensorFlow (webgl, con fallback a cpu)
      const tf = faceapi.tf as unknown as { setBackend: (b: string) => Promise<boolean>; ready: () => Promise<void>; getBackend: () => string };
      try { await tf.setBackend('webgl'); } catch { /* sin webgl */ }
      await tf.ready();
      if (tf.getBackend() !== 'webgl') {
        try { await tf.setBackend('cpu'); await tf.ready(); } catch { /* nada */ }
      }
      const u = import.meta.env.BASE_URL + 'models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(u),
        faceapi.nets.faceLandmark68Net.loadFromUri(u),
      ]);
    })();
  }
  return faceModelsP;
}

const BACKEND = 'http://localhost:8000';

interface TrackCard { title: string; rank?: number; link?: string; preview?: string | null; album?: string }
interface Shared { title: string; link?: string; preview?: string | null; spotify_search?: string }
interface Collab { id: string; name: string; picture?: string | null; link?: string | null; tracks: Shared[] }
interface Dated { title: string; date: string; cover?: string | null }
interface HistoryData {
  artist: { id: string; name: string; picture?: string | null; picture_xl?: string | null; link?: string | null; fans?: number };
  stats: {
    albums: number; singles?: number; releases?: number; tracks: number;
    oldest: Dated | null; newest: Dated | null;
    most_played: TrackCard | null; least_played: TrackCard | null;
  };
  graph: { center: { id: string; name: string; picture?: string | null }; collaborators: Collab[] };
}
interface Rec { name: string; compatibility: number; listeners: number | null; picture?: string | null; preview?: string | null; reasons: string[]; audio?: { bpm?: number; key?: string }; }

// PLANTILLAS curadas: cada una replica el patrón de una referencia como conjunto
// coherente (paleta + layout + tipografía + filtro de foto + pegatinas + encuadre).
export interface Tpl {
  id: string; bg: string; title: string; ink: string; burst: string; d2: [string, string];
  filter: 'bw' | 'color' | 'duotone' | 'halftone' | 'dither' | 'ascii';
  layout: 'bottom' | 'top' | 'band' | 'split' | 'magazine' | 'star';
  font: string; decor?: 'magazine' | 'jp' | 'star'; objPos?: string;
}
export const TEMPLATES: Tpl[] = [
  // Eminem magazine: papel envejecido, título rojo, foto B/N centrada, pegatinas
  { id: 'magazine', bg: '#e7e0cf', title: '#d6261b', ink: '#161616', burst: '#d6261b', d2: ['#1a1a1a', '#efe7d6'], filter: 'bw', layout: 'magazine', font: 'st-anton', decor: 'magazine', objPos: 'center 12%' },
  // "GREY OVER": B/N halftone + manchas verdes, título blanco abajo, tipografía JP
  { id: 'greyjp', bg: '#f0eee7', title: '#f6f6f1', ink: '#0c0c0c', burst: '#8fe000', d2: ['#0c0c0c', '#f0eee7'], filter: 'halftone', layout: 'bottom', font: 'st-archivo', decor: 'jp', objPos: 'center 8%' },
  // "WHAT'S THE WORST" — negro, foto B/N halftone, rojo
  { id: 'scream', bg: '#0a0a0a', title: '#e8392f', ink: '#e8392f', burst: '#e8392f', d2: ['#0a0a0a', '#f0f0f0'], filter: 'halftone', layout: 'bottom', font: 'st-anton', objPos: 'center 18%' },
  // "DON'T TRYNA ACT COOL" — duotono rojo/crema, franja
  { id: 'inkred', bg: '#e8392f', title: '#15110f', ink: '#15110f', burst: '#15110f', d2: ['#2a0606', '#f2d9c8'], filter: 'duotone', layout: 'band', font: 'st-archivo', objPos: 'center 14%' },
  // "GREY OVER" — B/N halftone + verde ácido, título blanco
  { id: 'toxic', bg: '#0a0a0a', title: '#f2ece0', ink: '#c6ff2e', burst: '#c6ff2e', d2: ['#06140a', '#dfffe0'], filter: 'halftone', layout: 'bottom', font: 'st-archivo', objPos: 'center 12%' },
  // Eminem azul — duotono azul/crema, título crema arriba
  { id: 'electric', bg: '#0b0b32', title: '#f2ece0', ink: '#c6ff2e', burst: '#c6ff2e', d2: ['#070730', '#dfe6ff'], filter: 'duotone', layout: 'top', font: 'st-archivo', objPos: 'center 10%' },
  // CYBER — foto en ASCII verde sobre negro
  { id: 'cyber', bg: '#05060a', title: '#c6ff2e', ink: '#7fd4ff', burst: '#c6ff2e', d2: ['#05060a', '#c6ff2e'], filter: 'ascii', layout: 'top', font: 'st-bebas', objPos: 'center 12%' },
  // LO-FI — dither 1-bit rosa
  { id: 'lofi', bg: '#101010', title: '#ff3b81', ink: '#f2ece0', burst: '#ff3b81', d2: ['#101010', '#ffd0e6'], filter: 'dither', layout: 'split', font: 'st-bungee', objPos: 'center 12%' },
  // SUNRISE — foto a color + título amarillo bungee
  { id: 'sunrise', bg: '#1f6fb0', title: '#ffd23a', ink: '#ffffff', burst: '#ffd23a', d2: ['#0a2a4a', '#ffe9a0'], filter: 'color', layout: 'top', font: 'st-bungee', objPos: 'center 10%' },
  // OUTLINE graffiti — negro, título contorno ámbar
  { id: 'graffiti', bg: '#141008', title: '#ff8a1f', ink: '#f2ece0', burst: '#ff8a1f', d2: ['#1c0e05', '#ffe3c0'], filter: 'halftone', layout: 'bottom', font: 'st-anton st-outline', objPos: 'center 12%' },
  // STARBOY — azul noche + B/N halftone + estrella y rayos amarillos (ref Felix)
  { id: 'starboy', bg: '#141834', title: '#ffe11a', ink: '#ffe11a', burst: '#ffe11a', d2: ['#0c0e22', '#ffffff'], filter: 'halftone', layout: 'star', font: 'st-archivo', decor: 'star', objPos: 'center 10%' },
];
export const rgb01 = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
function hash(s: string, salt = 0) { let h = salt; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

export const BACKEND_IMG = (url?: string | null) => url ? `http://localhost:8000/img?url=${encodeURIComponent(url)}` : '';
const rgb255 = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };

// Filtro DITHER (Bayer 4×4, 2 colores) → estética 1-bit retro.
function DitherPhoto({ url, dark, light }: { url: string; dark: string; light: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url;
    img.onload = () => {
      const c = ref.current; if (!c) return;
      const W = 200, H = Math.max(1, Math.round(W * img.height / img.width));
      c.width = W; c.height = H;
      const ctx = c.getContext('2d'); if (!ctx) return;
      ctx.drawImage(img, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H); const px = d.data;
      const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
      const dc = rgb255(dark), lc = rgb255(light);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const th = (bayer[y & 3][x & 3] + 0.5) / 16 * 255;
        const col = lum > th ? lc : dc;
        px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
      }
      ctx.putImageData(d, 0, 0);
    };
  }, [url, dark, light]);
  return <canvas ref={ref} className="poster-canvas" />;
}

// Filtro ASCII → la foto renderizada con caracteres (estética terminal/cyber).
function AsciiPhoto({ url, color }: { url: string; color: string }) {
  const [txt, setTxt] = useState('');
  useEffect(() => {
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url;
    img.onload = () => {
      const cols = 110, rows = Math.max(1, Math.round(cols * img.height / img.width * 0.5));
      const c = document.createElement('canvas'); c.width = cols; c.height = rows;
      const ctx = c.getContext('2d'); if (!ctx) return;
      ctx.drawImage(img, 0, 0, cols, rows);
      const d = ctx.getImageData(0, 0, cols, rows).data;
      const ramp = '@%#*+=-:. ';
      let s = '';
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
          s += ramp[Math.min(ramp.length - 1, Math.floor(lum * (ramp.length - 1)))];
        }
        s += '\n';
      }
      setTxt(s);
    };
  }, [url]);
  return <pre className="poster-ascii-art" style={{ color }}>{txt}</pre>;
}

// Foto en ZOOM a la cara + estrella sobre el ojo (canvas). Usa FaceDetector si
// existe; si no, recorta el tercio superior (donde suele estar la cara).
function StarFacePhoto({ url, color }: { url: string; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancel = false;
    const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url;
    img.onload = async () => {
      const c = ref.current; if (!c) return;
      const CW = 760, CH = 1060; c.width = CW; c.height = CH;
      const ctx = c.getContext('2d'); if (!ctx) return;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const aspect = CW / CH;
      const draw = (box: { x: number; y: number; w: number; h: number }, eyeImg: { x: number; y: number } | null) => {
        const fcx = box.x + box.w / 2, fcy = box.y + box.h * 0.5;
        let sh = Math.min(ih, box.h * 3.1), sw = sh * aspect;
        if (sw > iw) { sw = iw; sh = sw / aspect; }
        // la cara va hacia la DERECHA del póster → deja la izquierda libre para el texto
        let sx = fcx - sw * 0.64, sy = fcy - sh * 0.36;
        sx = Math.max(0, Math.min(iw - sw, sx)); sy = Math.max(0, Math.min(ih - sh, sy));
        ctx.clearRect(0, 0, CW, CH);
        ctx.filter = 'grayscale(1) contrast(1.55) brightness(1.06)';
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CW, CH);
        ctx.filter = 'none';
        const ep = eyeImg ?? { x: box.x + box.w * 0.5, y: box.y + box.h * 0.4 };
        const ex = (ep.x - sx) / sw * CW, ey = (ep.y - sy) / sh * CH;
        const r = CW * 0.2;
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(-0.08); ctx.beginPath();
        for (let i = 0; i < 10; i++) { const ang = Math.PI / 5 * i - Math.PI / 2; const rad = i % 2 ? r * 0.42 : r; const px = Math.cos(ang) * rad, py = Math.sin(ang) * rad; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.globalAlpha = 0.78; ctx.fillStyle = color; ctx.fill(); ctx.restore();
      };
      // 1) dibujo INMEDIATO (recorte por defecto) → la foto siempre se ve
      draw({ x: iw * 0.34, y: ih * 0.06, w: iw * 0.32, h: ih * 0.24 }, null);
      // 2) detección de cara → redibujar con zoom a la cara + estrella en el ojo
      try {
        await loadFaceModels();
        const det = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.3 }))
          .withFaceLandmarks();
        if (det && !cancel) {
          const b = det.detection.box;
          const le = det.landmarks.getLeftEye();
          const sum = le.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
          draw({ x: b.x, y: b.y, w: b.width, h: b.height }, { x: sum.x / le.length, y: sum.y / le.length });
        }
      } catch { /* se queda con el dibujo por defecto */ }
    };
    return () => { cancel = true; };
  }, [url, color]);
  return <canvas ref={ref} className="poster-canvas" />;
}

// La ficha del artista renderizada como PÓSTER editorial (foto + tipografía gigante).
function ArtistPoster({ data, blurb }: { data: HistoryData; blurb?: string }) {
  const a = data.artist, s = data.stats;
  const [variant, setVariant] = useState(0);  // "rediseñar" avanza tema + layout
  const tpl = TEMPLATES[(hash(a.name || 'x', 7) + variant) % TEMPLATES.length];
  const t = tpl, layout = tpl.layout, titleStyle = tpl.font, photo = tpl.filter;
  const dRGB = rgb01(tpl.d2[0]), lRGB = rgb01(tpl.d2[1]);
  const imgUrl = BACKEND_IMG(a.picture_xl || a.picture);
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // formato: banner (apaisado, por defecto en pantallas anchas) o póster (vertical)
  const [fmt, setFmt] = useState<'banner' | 'poster'>(
    () => (typeof window !== 'undefined' && window.innerWidth < 820 ? 'poster' : 'banner'));
  const yA = s.oldest?.date?.slice(0, 4);
  const yB = s.newest?.date?.slice(0, 4);
  const years = yA && yB ? (yA === yB ? yA : `${yA}–${yB}`) : '—';
  const vars = {
    ['--pbg']: t.bg, ['--ptitle']: t.title, ['--pink']: t.ink, ['--pburst']: t.burst,
  } as CSSProperties;

  const download = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const url = await toPng(ref.current, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement('a');
      link.download = `${a.name}-chupitbeats.png`.replace(/\s+/g, '_');
      link.href = url; link.click();
    } catch { /* nada */ } finally { setBusy(false); }
  };
  const share = async () => {
    const url = `${location.origin}${location.pathname}?a=${encodeURIComponent(a.name || '')}`;
    if (navigator.share) { try { await navigator.share({ title: `${a.name} · ChupitBeats`, url }); return; } catch { /* cancelado */ } }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* nada */ }
  };

  return (
    <div className="poster-wrap">
      <div className={`poster fmt-${fmt} l-${layout} p-${photo}`} data-tpl={tpl.id} style={vars} ref={ref}>
        {/* filtro duotono (2 colores) */}
        {photo === 'duotone' && (
          <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
            <filter id="posterDuo" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 1 0" />
              <feComponentTransfer>
                <feFuncR type="table" tableValues={`${dRGB[0]} ${lRGB[0]}`} />
                <feFuncG type="table" tableValues={`${dRGB[1]} ${lRGB[1]}`} />
                <feFuncB type="table" tableValues={`${dRGB[2]} ${lRGB[2]}`} />
              </feComponentTransfer>
            </filter>
          </svg>
        )}
        <div className="poster-photo">
          {tpl.decor === 'star'
            ? <StarFacePhoto url={imgUrl} color={tpl.burst} />
            : photo === 'dither'
            ? <DitherPhoto url={imgUrl} dark={tpl.d2[0]} light={tpl.d2[1]} />
            : photo === 'ascii'
              ? <AsciiPhoto url={imgUrl} color={tpl.ink} />
              : imgUrl && <img crossOrigin="anonymous" src={imgUrl} alt={a.name}
                style={{ objectPosition: tpl.objPos, ...(photo === 'duotone' ? { filter: 'contrast(1.12) url(#posterDuo)' } : {}) }} />}
        </div>
        <span className="poster-burst" aria-hidden />
        {tpl.decor === 'magazine' && (
          <div className="poster-stickers" aria-hidden>
            <span className="stk-barcode" />
            <span className="stk-tag">PARENTAL ADVISORY</span>
            <span className="stk-rec">● REC</span>
            <span className="stk-kanji">アンダーグラウンド</span>
          </div>
        )}
        {tpl.decor === 'star' && (
          <div className="poster-star-decor" aria-hidden>
            <span className="sd-spike sp1" /><span className="sd-spike sp2" /><span className="sd-spike sp3" />
            <span className="sd-quote">{blurb || 'So proud of myself, never doubt who we are'}</span>
            <span className="sd-handle">@chupitbeats</span>
            <span className="sd-credit">★ {a.name} ★</span>
          </div>
        )}
        {tpl.decor === 'jp' && (
          <div className="poster-jp" aria-hidden>
            <span className="jp-blob jp-b1" /><span className="jp-blob jp-b2" />
            <span className="jp-blob jp-b3" /><span className="jp-blob jp-b4" />
            <span className="jp-date">4月2日(土) 19:00<br />4月3日(日) 14:00</span>
            <span className="jp-type">TYPE →</span>
            <span className="jp-place">m_kan place<br />津あけぼの座</span>
            <span className="jp-credit">INTERNATIONAL<br />ART &amp; DESIGN<br />CONGRESS</span>
            <span className="jp-smiley">◡</span>
          </div>
        )}
        <div className="poster-copy">
          <div className="poster-kicker">CHUPITBEATS · DOSSIER</div>
          {blurb && <div className="pm-blurb">“{blurb}”</div>}
          <div className="pm"><span>Discografía</span>{s.albums} álb/EP · {s.singles ?? 0} singles · {s.tracks} temas</div>
          <div className="pm"><span>Activo</span>{years}</div>
          <div className="pm"><span>Más sonada</span>{s.most_played?.title ?? '—'}</div>
          <div className="pm"><span>Red</span>{data.graph.collaborators.length} colaboradores</div>
        </div>
        <h1 className={`poster-name ${titleStyle}`}>{a.name}</h1>
        <div className="poster-foot">{(a.fans ?? 0).toLocaleString()} FANS — UNDERGROUND ENGINE</div>
      </div>
      <div className="poster-actions">
        <button className="btn-mini ghost" onClick={() => setVariant(v => v + 1)}>🎲 Rediseñar</button>
        <button className="btn-mini ghost" onClick={() => setFmt(f => f === 'banner' ? 'poster' : 'banner')}>
          {fmt === 'banner' ? '▭ Ver como póster' : '▬ Ver como banner'}
        </button>
        <button className="btn-mini" onClick={download} disabled={busy}>{busy ? '…' : '⬇ Descargar PNG'}</button>
        <button className="btn-mini ghost" onClick={share}>{copied ? '✓ Enlace copiado' : '↗ Compartir'}</button>
        {a.link && <a className="btn-mini ghost" href={a.link} target="_blank" rel="noreferrer">Deezer ↗</a>}
      </div>
    </div>
  );
}

export default function History({ initialQuery }: { initialQuery?: string }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<HistoryData | null>(null);
  const [blurb, setBlurb] = useState('');                // frase editorial IA
  const [sel, setSel] = useState<Collab | null>(null);   // arista seleccionada
  const [emerg, setEmerg] = useState<Rec[] | null>(null); // emergentes parecidos (Discovery)
  const [emergBusy, setEmergBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [gw, setGw] = useState(800);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [hover, setHover] = useState<string | null>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [, setImgTick] = useState(0);

  // Carga (y cachea) la foto de cada artista para pintarla dentro de su bola.
  const getImg = useCallback((url?: string | null): HTMLImageElement | null => {
    if (!url) return null;
    let im = imgCache.current.get(url);
    if (!im) {
      im = new Image();
      im.onload = () => setImgTick(t => t + 1);  // repinta cuando llega la foto
      im.src = url;
      imgCache.current.set(url, im);
    }
    return im.complete && im.naturalWidth > 0 ? im : null;
  }, []);

  // Físicas: más repulsión + colisión para que las bolas no se solapen.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !data) return;
    fg.d3Force('charge')?.strength(-260);
    fg.d3Force('link')?.distance(95).strength(0.5);
    fg.d3Force('collide', forceCollide(22));
    fg.d3ReheatSimulation();
  }, [data]);

  useEffect(() => {
    const measure = () => { if (wrapRef.current) setGw(wrapRef.current.clientWidth); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [data]);

  // emergentes que suenan parecido (Discovery con este artista como semilla, bajo demanda)
  const loadEmerg = useCallback(async () => {
    if (!data) return;
    setEmergBusy(true);
    try {
      const r = await fetch(`${BACKEND}/discover`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seeds: [data.artist.name], max_listeners: 80000, results: 8, analyze_top: 12 }),
      });
      const j = await r.json();
      setEmerg(j.recommendations || []);
    } catch { setEmerg([]); } finally { setEmergBusy(false); }
  }, [data]);

  // frase editorial generada por IA (tras cargar el artista)
  useEffect(() => {
    setBlurb(''); setEmerg(null);
    if (!data) return;
    let cancel = false;
    fetch(`${BACKEND}/blurb`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.artist.name, stats: data.stats, collaborators: data.graph.collaborators.slice(0, 3) }),
    }).then(r => r.json()).then(j => { if (!cancel && j.blurb) setBlurb(j.blurb); }).catch(() => {});
    return () => { cancel = true; };
  }, [data]);

  const run = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setBusy(true); setError(''); setData(null); setSel(null);
    try {
      const r = await fetch(`${BACKEND}/artist-history`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: q.trim() }),
      });
      if (r.status === 404) { setError('No se encontró ese artista.'); return; }
      if (!r.ok) throw new Error(`${r.status}`);
      setData(await r.json());
    } catch (e) {
      setError(`${(e as Error).message}. ¿Está el backend en localhost:8000?`);
    } finally { setBusy(false); }
  }, []);
  const search = useCallback(() => run(name), [run, name]);

  // query inicial (desde la landing) o ?a=Artista → abre su póster directo
  useEffect(() => {
    const q = initialQuery || new URLSearchParams(window.location.search).get('a');
    if (q) { setName(q); run(q); }
  }, [run]);

  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  // reproducir / pausar (toggle) la misma pista
  const toggle = (url?: string | null) => {
    if (!url) return;
    const a = audioRef.current ?? (audioRef.current = new Audio());
    if (playingUrl === url) { a.pause(); setPlayingUrl(null); return; }
    a.src = url;
    a.onended = () => setPlayingUrl(null);
    a.play().then(() => setPlayingUrl(url)).catch(() => setPlayingUrl(null));
  };

  // Memoizado SOLO por `data`: si se recrea en cada render (p.ej. al mover el
  // ratón), el grafo reinicia la simulación y da "espasmos" / no se puede arrastrar.
  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return {
      nodes: [
        { id: data.graph.center.id, name: data.graph.center.name, center: true,
          img: data.artist.picture, weight: 0 },
        ...data.graph.collaborators.map(c => ({
          id: c.id, name: c.name, img: c.picture, weight: c.tracks.length })),
      ],
      links: data.graph.collaborators.map(c => ({
        source: data.graph.center.id, target: c.id, weight: c.tracks.length, collab: c,
      })),
    };
  }, [data]);

  return (
    <div className="remix">
      <div className="remix-bg" />
      <div className="remix-inner">
        <header className="remix-hero">
          <h1>HIS<span>TORIAL</span></h1>
          <p>Toda la historia de un artista y su <b>mapa de colaboraciones</b>.</p>
        </header>

        <div className="drop-zone">
          <div className="drop-row">
            <input className="url-input" placeholder="Escribe un artista" value={name}
              disabled={busy} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') search(); }} />
            <button className="btn-remix" onClick={search} disabled={busy || !name.trim()}>
              {busy ? '…' : '🔎 Ver historial'}
            </button>
          </div>
        </div>

        {error && <div className="status err">{error}</div>}

        {data && (
          <div className="results">
            {/* Cabecera = PÓSTER editorial del artista */}
            <ArtistPoster data={data} blurb={blurb} />

            {/* Estadísticas */}
            <div className="chips">
              <div className="chip"><span>{data.stats.albums}</span>Álbumes/EPs</div>
              <div className="chip"><span>{data.stats.singles ?? 0}</span>Singles</div>
              <div className="chip"><span>{data.stats.tracks}</span>Canciones</div>
              <div className="chip"><span>{data.stats.oldest?.date?.slice(0, 4) ?? '—'}</span>Primer lanz.</div>
              <div className="chip"><span>{data.stats.newest?.date?.slice(0, 4) ?? '—'}</span>Último lanz.</div>
            </div>

            <div className="hist-tracks">
              {([
                ['🕰 Más antigua', data.stats.oldest?.title, data.stats.oldest?.date, null],
                ['✨ Más nueva', data.stats.newest?.title, data.stats.newest?.date, null],
                ['🔥 Más reproducida', data.stats.most_played?.title, data.stats.most_played?.album, data.stats.most_played?.preview],
                ['🥶 Menos reproducida', data.stats.least_played?.title, data.stats.least_played?.album, data.stats.least_played?.preview],
              ] as [string, string | undefined, string | undefined | null, string | null | undefined][]).map(([label, title, sub, prev]) => (
                <div key={label} className="hist-track">
                  <div className="hist-track-label">{label}</div>
                  <div className="hist-track-title">{title ?? '—'}</div>
                  {sub && <div className="rec-meta">{sub}</div>}
                  {prev && <button className="btn-mini" onClick={() => toggle(prev)}>{playingUrl === prev ? '⏸ Pausa' : '▶ Escuchar'}</button>}
                </div>
              ))}
            </div>

            {/* Grafo neuronal de colaboraciones */}
            <div className="analysis-card">
              <h3>Mapa de colaboraciones · {data.graph.collaborators.length} artistas</h3>
              <p className="muted">Clic en un artista → explora su póster · clic en una línea → la canción que comparten</p>
              <div className="graph-wrap" ref={wrapRef}>
                <ForceGraph2D
                  ref={fgRef}
                  graphData={graphData}
                  width={gw}
                  height={520}
                  backgroundColor="rgba(0,0,0,0)"
                  cooldownTicks={120}
                  onEngineStop={() => fgRef.current?.zoomToFit(500, 60)}
                  linkColor={(l) => {
                    const lk = l as { source: { id?: string }; target: { id?: string } };
                    const on = hover && (lk.source.id === hover || lk.target.id === hover);
                    return on ? 'rgba(0,255,204,0.9)' : 'rgba(0,255,204,0.18)';
                  }}
                  linkWidth={(l) => {
                    const lk = l as { weight?: number; target: { id?: string } };
                    const on = hover && lk.target.id === hover;
                    return (on ? 2 : 0) + Math.min(5, 1 + (lk.weight ?? 1) * 0.6);
                  }}
                  onNodeHover={(n) => {
                    const id = (n as { id?: string } | null)?.id ?? null;
                    setHover(prev => (prev === id ? prev : id));
                  }}
                  onLinkClick={(l) => setSel((l as { collab?: Collab }).collab ?? null)}
                  onNodeClick={(n) => {
                    const node = n as { center?: boolean; name?: string };
                    if (node.center || !node.name) return;  // el central es el artista actual
                    // EXPLORAR: cargar el póster de ese colaborador
                    setName(node.name); run(node.name);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  nodePointerAreaPaint={(node, color, ctx) => {
                    const n = node as { x: number; y: number; center?: boolean; weight?: number };
                    const r = (n.center ? 18 : 13 + Math.min(8, (n.weight ?? 0)));
                    ctx.fillStyle = color;
                    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI); ctx.fill();
                  }}
                  nodeCanvasObject={(node, ctx, scale) => {
                    const n = node as { x: number; y: number; name: string; center?: boolean; weight?: number; img?: string | null; id: string };
                    const r = n.center ? 16 : 9 + Math.min(8, (n.weight ?? 0));
                    const img = getImg(n.img);
                    ctx.save();
                    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI); ctx.closePath();
                    if (img) {
                      ctx.clip();
                      ctx.drawImage(img, n.x - r, n.y - r, r * 2, r * 2);
                      ctx.restore();
                    } else {
                      ctx.fillStyle = n.center ? '#ff2d6b' : '#0c3b34';
                      ctx.fill(); ctx.restore();
                    }
                    // aro de color
                    const hot = n.center || n.id === hover;
                    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
                    ctx.lineWidth = (hot ? 2.5 : 1.5) / scale;
                    ctx.strokeStyle = n.center ? '#ff2d6b' : (hot ? '#fff' : '#00ffcc');
                    ctx.stroke();
                    // etiqueta solo en el centro o al pasar el ratón (evita amontonar)
                    if (n.center || n.id === hover) {
                      const fs = 12 / scale;
                      ctx.font = `${n.center ? 700 : 500} ${fs}px Inter, system-ui, sans-serif`;
                      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                      const w = ctx.measureText(n.name).width;
                      const pad = 4 / scale;
                      ctx.fillStyle = 'rgba(6,7,10,0.85)';
                      ctx.fillRect(n.x - w / 2 - pad, n.y + r + 2 / scale, w + pad * 2, fs + pad);
                      ctx.fillStyle = '#fff';
                      ctx.fillText(n.name, n.x, n.y + r + 3 / scale);
                    }
                  }}
                />
              </div>
            </div>

            {/* Panel de la colaboración seleccionada */}
            {sel && (
              <div className="base-panel">
                <div className="base-head">
                  <span>🎵 {data.artist.name} × {sel.name}</span>
                  <button className="btn-mini ghost" onClick={() => setSel(null)}>✕</button>
                </div>
                {sel.tracks.map((t, i) => (
                  <div key={i} className="collab-track">
                    <span>{t.title}</span>
                    <span className="collab-actions">
                      {t.preview && <button className="btn-mini" onClick={() => toggle(t.preview)}>{playingUrl === t.preview ? '⏸' : '▶'}</button>}
                      {t.link && <a className="btn-mini ghost" href={t.link} target="_blank" rel="noreferrer">Deezer ↗</a>}
                      {t.spotify_search && <a className="btn-mini ghost" href={t.spotify_search} target="_blank" rel="noreferrer">Spotify ↗</a>}
                    </span>
                  </div>
                ))}
                {sel.link && (
                  <a className="btn-mini ghost" style={{ alignSelf: 'flex-start', marginTop: 4 }}
                    href={sel.link} target="_blank" rel="noreferrer">
                    👤 Visitar perfil de {sel.name} ↗
                  </a>
                )}
              </div>
            )}

            {/* EMERGENTES que suenan parecido (unifica Discovery dentro del artista) */}
            <div className="analysis-card">
              <h3>Emergentes que suenan a {data.artist.name}</h3>
              {!emerg && !emergBusy && (
                <>
                  <p className="muted">Artistas poco conocidos con un sonido parecido (análisis de audio real).</p>
                  <button className="btn-remix" onClick={loadEmerg}>🔭 Descubrir emergentes</button>
                </>
              )}
              {emergBusy && <p className="muted">Analizando el sonido y rastreando emergentes… (puede tardar ~1 min)</p>}
              {emerg && emerg.length > 0 && (
                <div className="rec-grid">
                  {emerg.map(r => (
                    <div key={r.name} className="rec-card" style={{ cursor: 'pointer' }}
                      onClick={() => { setName(r.name); run(r.name); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                      <div className="rec-score" style={{ ['--p']: r.compatibility } as CSSProperties}><span>{r.compatibility}<small>%</small></span></div>
                      <div className="rec-body">
                        <div className="rec-head">
                          {r.picture && <img src={r.picture} alt="" className="rec-pic" />}
                          <div>
                            <div className="rec-name">{r.name}</div>
                            <div className="rec-meta">{r.listeners != null ? `${r.listeners.toLocaleString()} oy/mes` : ''}{r.audio?.bpm ? ` · ${r.audio.bpm}bpm` : ''}</div>
                          </div>
                        </div>
                        <div className="rec-reasons">{r.reasons.slice(0, 2).map((x, i) => <span key={i} className="reason">✓ {x}</span>)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {emerg && emerg.length === 0 && <p className="muted">No encontré emergentes claros para este artista.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
