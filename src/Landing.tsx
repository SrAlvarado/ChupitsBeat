import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TEMPLATES, BACKEND_IMG, rgb01 } from './History';

gsap.registerPlugin(ScrollTrigger);

const PRESETS = ['Quevedo', 'Bad Bunny', 'Bizarrap', 'Rosalía'];
// un DISEÑO de póster distinto por artista (id de plantilla real de History)
const GALLERY: { name: string; tpl: string }[] = [
  { name: 'QUEVEDO', tpl: 'scream' },
  { name: 'ROSALÍA', tpl: 'magazine' },
  { name: 'BAD BUNNY', tpl: 'toxic' },
  { name: 'BIZARRAP', tpl: 'greyjp' },
  { name: 'FEID', tpl: 'graffiti' },
  { name: 'AITANA', tpl: 'sunrise' },
  { name: 'C. TANGANA', tpl: 'inkred' },
];
const NAV: [string, string][] = [
  ['CARA A', '#caraa'], ['GALERÍA', '#galeria'], ['CARA B', '#carab'],
];

// Mini-póster real para la galería (misma plantilla que History).
function PosterCard({ name, tplId, onOpen }: { name: string; tplId: string; onOpen: () => void }) {
  const tpl = TEMPLATES.find(t => t.id === tplId) || TEMPLATES[0];
  const [pic, setPic] = useState('');
  useEffect(() => {
    let ok = true;
    fetch(`http://localhost:8000/artist-photo?q=${encodeURIComponent(name)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (ok && d?.picture_xl) setPic(d.picture_xl); })
      .catch(() => {});
    return () => { ok = false; };
  }, [name]);
  const imgUrl = BACKEND_IMG(pic);
  const duoId = `duo-${tpl.id}-${name.replace(/\W/g, '')}`;
  const dRGB = rgb01(tpl.d2[0]), lRGB = rgb01(tpl.d2[1]);
  const vars = { ['--pbg']: tpl.bg, ['--ptitle']: tpl.title, ['--pink']: tpl.ink, ['--pburst']: tpl.burst } as CSSProperties;
  return (
    <button className="g-card" onClick={onOpen} title={`Ver póster de ${name}`}>
      <div className={`poster fmt-poster l-${tpl.layout} p-${tpl.filter}`} data-tpl={tpl.id} style={vars}>
        {tpl.filter === 'duotone' && (
          <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
            <filter id={duoId} colorInterpolationFilters="sRGB">
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
          {imgUrl
            ? <img crossOrigin="anonymous" src={imgUrl} alt={name}
                style={{ objectPosition: tpl.objPos, ...(tpl.filter === 'duotone' ? { filter: `contrast(1.12) url(#${duoId})` } : {}) }} />
            : <span className="g-skel" />}
        </div>
        <span className="poster-burst" aria-hidden />
        {tpl.decor === 'magazine' && (
          <div className="poster-stickers" aria-hidden>
            <span className="stk-barcode" /><span className="stk-tag">PARENTAL ADVISORY</span>
            <span className="stk-rec">● REC</span><span className="stk-kanji">アンダーグラウンド</span>
          </div>
        )}
        {tpl.decor === 'jp' && (
          <div className="poster-jp" aria-hidden>
            <span className="jp-blob jp-b1" /><span className="jp-blob jp-b2" />
            <span className="jp-blob jp-b3" /><span className="jp-blob jp-b4" />
          </div>
        )}
        <h1 className={`poster-name ${tpl.font}`}>{name}</h1>
        <div className="poster-foot">CHUPITBEATS · DOSSIER</div>
      </div>
    </button>
  );
}

// La landing es la FUNDA DE UNA MIXTAPE: cara A (tracklist con la cinta
// desenrollándose al scroll), el muro de pósters, y cara B (tu turno).
// Nada de plantilla SaaS: sin stats inventadas, sin grid de features, sin cards.
export default function Landing({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = () => { if (q.trim()) onSearch(q.trim()); };
  const goTo = (e: MouseEvent<HTMLAnchorElement>, h: string) => {
    e.preventDefault(); setMenu(false);
    document.querySelector(h)?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      // carga del hero: nav baja, bottom sube, titular clip-reveal
      gsap.utils.toArray<HTMLElement>('[data-load="down"]').forEach((el) => {
        const i = parseFloat(el.style.getPropertyValue('--i') || '0');
        gsap.from(el, { opacity: 0, y: -20, duration: 0.5, delay: i * 0.1, ease: 'power3.out' });
      });
      gsap.utils.toArray<HTMLElement>('[data-load="up"]').forEach((el) => {
        const i = parseFloat(el.style.getPropertyValue('--i') || '0');
        gsap.from(el, { opacity: 0, y: 32, duration: 0.6, delay: i * 0.12, ease: 'power3.out' });
      });
      gsap.utils.toArray<HTMLElement>('.h-word').forEach((el, i) => {
        gsap.from(el, { yPercent: 110, duration: 0.7, delay: 0.4 + i * 0.14, ease: 'power4.out' });
      });

      // scrollytelling: la CINTA se desenrolla bajando por la cara A
      gsap.fromTo('.tape-line', { scaleY: 0 }, { scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: '.side-a', start: 'top 70%', end: 'bottom 60%', scrub: 0.6 } });

      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.from(el, { opacity: 0, y: 44, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 86%' } });
      });
      gsap.utils.toArray<HTMLElement>('.mh').forEach((el) => {
        gsap.from(el, { yPercent: 115, duration: 0.9, ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 90%' } });
      });
      // sellos de goma: se estampan al llegar
      gsap.utils.toArray<HTMLElement>('.stamp').forEach((el, i) => {
        gsap.from(el, { scale: 2.2, opacity: 0, rotate: -18, duration: 0.4, delay: i * 0.12, ease: 'power4.in',
          scrollTrigger: { trigger: el.closest('.track'), start: 'top 62%' } });
      });
      // los hilos rojos de la red se dibujan al llegar
      gsap.utils.toArray<SVGPathElement>('.web-lines path').forEach((el, i) => {
        const len = el.getTotalLength();
        gsap.fromTo(el, { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, duration: 1, delay: i * 0.18, ease: 'power2.out',
            scrollTrigger: { trigger: '.web', start: 'top 75%' } });
      });

      // galería horizontal con pin
      const t = track.current;
      if (t) {
        const len = () => t.scrollWidth - window.innerWidth;
        gsap.to(t, { x: () => -len(), ease: 'none',
          scrollTrigger: { trigger: '.land-gallery', start: 'top top', end: () => '+=' + len(),
            scrub: 1, pin: true, anticipatePin: 1, invalidateOnRefresh: true } });
      }
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = (
    <div className="land-search">
      <input placeholder="ESCRIBE UN ARTISTA…" value={q}
        onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') go(); }} />
      <button className="btn-phys" onClick={go}>● REC</button>
    </div>
  );

  return (
    <div className="land" ref={root}>
      {/* HERO: vídeo de casete + titular apilado. Nav mínimo (nada de logo-links-CTA) */}
      <section className="land-hero" id="top">
        <video className="hero-video" src={`${import.meta.env.BASE_URL}video/cassette.mp4`}
          autoPlay muted loop playsInline aria-hidden />
        <div className="hero-tint" aria-hidden />

        <nav className="h-nav">
          <a className="h-logo" href="#top" data-load="down" style={{ ['--i']: 0 } as CSSProperties}
            onClick={e => goTo(e, '#top')}><span className="h-dot" />CHUPIT<b>BEATS</b></a>
          <div className="h-side" data-load="down" style={{ ['--i']: 1 } as CSSProperties}>
            <span className="h-tape-info">CARA A · 90 MIN · CrO₂</span>
            <button className="h-burger" onClick={() => setMenu(true)} aria-label="índice"><span /><span /><span /></button>
          </div>
        </nav>

        <div className="h-bottom">
          <div className="h-rowA">
            <p className="h-tag" data-load="up" style={{ ['--i']: 2 } as CSSProperties}>
              GRABADO EN CASA<br />SIN PERMISO DE NADIE<br />REBOBINA ANTES DE DEVOLVER
            </p>
            <div className="h-search" data-load="up" style={{ ['--i']: 3 } as CSSProperties}>{search}</div>
          </div>
          <div className="h-rowB">
            <p className="h-desc" data-load="up" style={{ ['--i']: 4 } as CSSProperties}>
              ESTO NO ES UN DASHBOARD. ES UNA FOTOCOPIADORA DE LEYENDAS: METES UN NOMBRE Y SACAS SU PÓSTER.
            </p>
            <h1 className="h-title">
              {['SONIDO', 'HECHO', 'PÓSTER'].map((w, i) => (
                <span className="mask-h" key={w}><span className={`h-word${i === 2 ? ' red' : ''}`}>{w}</span></span>
              ))}
            </h1>
          </div>
        </div>
      </section>

      {/* menú overlay (índice de la funda) */}
      {menu && (
        <div className="h-menu">
          <div className="h-nav">
            <a className="h-logo" href="#top" onClick={e => goTo(e, '#top')}><span className="h-dot" />CHUPIT<b>BEATS</b></a>
            <button className="h-close" onClick={() => setMenu(false)} aria-label="cerrar">✕</button>
          </div>
          <nav className="h-menu-links">
            {NAV.map(([t, h]) => <a key={t} href={h} onClick={e => goTo(e, h)}>{t}</a>)}
          </nav>
          <div className="h-menu-foot">
            <div className="presets">
              <span className="muted">prueba:</span>
              {PRESETS.map(p => <button key={p} className="preset-chip" onClick={() => onSearch(p)}>{p}</button>)}
            </div>
          </div>
        </div>
      )}

      {/* marquee tinta */}
      <div className="land-marquee" aria-hidden>
        <div className="mq-track">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>DESCUBRE <b>◆</b> POR SONIDO <b>◆</b> PÓSTER <b>◆</b> TIRA DEL HILO <b>◆</b> UNDERGROUND <b>◆</b>{' '}</span>
          ))}
        </div>
      </div>

      {/* CARA A · tracklist con la cinta desenrollándose */}
      <section className="side-a" id="caraa">
        <div className="side-head">
          <span className="side-strip">CARA A · LO QUE HACE ESTA CINTA</span>
        </div>
        <span className="tape-line" aria-hidden />

        <article className="track" id="descubre">
          <span className="tk-no" aria-hidden>01</span>
          <div className="tk-body">
            <div className="tk-time">PISTA 01 — 3:42</div>
            <h2 className="mask-h"><span className="mh">DESCUBRE POR <em>SONIDO</em></span></h2>
            <p className="tk-copy reveal">
              Escuchamos el audio de verdad, no las etiquetas de la discográfica.
              Si suena parecido, entra. Si no, fuera.
            </p>
          </div>
          <div className="tk-visual stamps" aria-hidden>
            <span className="stamp">BPM 128</span>
            <span className="stamp">TONO LAm</span>
            <span className="stamp">BRILLO 9/10</span>
            <span className="stamp big">ANALIZADO ✓</span>
          </div>
        </article>

        <article className="track" id="poster">
          <span className="tk-no" aria-hidden>02</span>
          <div className="tk-body">
            <div className="tk-time">PISTA 02 — 2:58</div>
            <h2 className="mask-h"><span className="mh">SU HISTORIA, <em>FOTOCOPIADA</em></span></h2>
            <p className="tk-copy reveal">
              Fechas, temas, colaboraciones y una frase con alma. Todo grapado
              en un póster que puedes bajarte y pegar donde te dejen.
            </p>
          </div>
          <div className="tk-visual">
            <PosterCard name="QUEVEDO" tplId="scream" onOpen={() => onSearch('Quevedo')} />
          </div>
        </article>

        <article className="track" id="red">
          <span className="tk-no" aria-hidden>03</span>
          <div className="tk-body">
            <div className="tk-time">PISTA 03 — 4:15</div>
            <h2 className="mask-h"><span className="mh">TIRA DEL <em>HILO</em></span></h2>
            <p className="tk-copy reveal">
              De feat en feat hasta el fondo del underground. Cada colaboración
              es un hilo; al final del hilo hay otro póster.
            </p>
          </div>
          <div className="tk-visual web" aria-hidden>
            <svg className="web-lines" viewBox="0 0 300 220" fill="none">
              <path d="M40 40 L150 110" stroke="#d6261b" strokeWidth="2" />
              <path d="M150 110 L250 50" stroke="#d6261b" strokeWidth="2" />
              <path d="M150 110 L70 180" stroke="#d6261b" strokeWidth="2" />
              <path d="M150 110 L240 180" stroke="#d6261b" strokeWidth="2" />
              <path d="M40 40 L250 50" stroke="#d6261b" strokeWidth="1.2" />
            </svg>
            <span className="web-name" style={{ top: '8%', left: '4%' }}>QUEVEDO</span>
            <span className="web-name center" style={{ top: '44%', left: '38%' }}>BIZARRAP</span>
            <span className="web-name" style={{ top: '10%', right: '2%' }}>DUKI</span>
            <span className="web-name" style={{ top: '76%', left: '10%' }}>ROSALÍA</span>
            <span className="web-name" style={{ top: '76%', right: '4%' }}>C. TANGANA</span>
          </div>
        </article>
      </section>

      {/* marquee ácido */}
      <div className="land-marquee alt" aria-hidden>
        <div className="mq-track">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>MIXTAPE <b>◆</b> CARA A <b>◆</b> CARA B <b>◆</b> DOLBY <b>◆</b> 90 MIN <b>◆</b> HI-FI <b>◆</b>{' '}</span>
          ))}
        </div>
      </div>

      {/* muro rojo: pósters colgados con cinta adhesiva */}
      <section className="land-gallery" id="galeria">
        <div className="gallery-track" ref={track}>
          <div className="g-intro">
            <h2 className="mask-h"><span className="mh">Un póster<br /><em>por artista</em></span></h2>
            <p>desliza →</p>
          </div>
          {GALLERY.map(({ name, tpl }) => (
            <PosterCard key={name} name={name} tplId={tpl} onOpen={() => onSearch(name)} />
          ))}
        </div>
      </section>

      {/* CARA B · tu turno: la etiqueta en blanco */}
      <section className="side-b" id="carab">
        <div className="side-head">
          <span className="side-strip">CARA B · TU TURNO</span>
        </div>
        <h2 className="sb-line mask-h"><span className="mh">LA CINTA SE ACABÓ.<br />GRABA LA <em>TUYA</em>.</span></h2>
        <div className="sb-label reveal">
          <span className="sb-side">B</span>
          <div className="sb-fields">
            <span className="sb-caption">ARTISTA:</span>
            {search}
            <div className="presets">
              <span className="muted">o roba uno:</span>
              {PRESETS.map(p => <button key={p} className="preset-chip" onClick={() => onSearch(p)}>{p}</button>)}
            </div>
          </div>
        </div>
        <p className="sb-foot">CHUPITBEATS · HECHO A MANO · REBOBINA ANTES DE DEVOLVER</p>
      </section>
    </div>
  );
}
