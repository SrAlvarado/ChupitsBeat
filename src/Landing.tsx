import { useEffect, useRef, useState, type MouseEvent, type CSSProperties } from 'react';
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

// Mini-póster real para la galería: mismas plantillas que History, con la foto
// del artista (Deezer vía proxy /img) y su tipografía/paleta/decoración.
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
const STEPS = [
  ['01', 'Busca', 'Escribe cualquier artista.'],
  ['02', 'Analiza', 'Leemos su audio real: BPM, tono, energía, brillo.'],
  ['03', 'Convierte', 'Te devolvemos su póster, su red y sus emergentes.'],
];

// Landing scrollable con MUCHAS animaciones de scroll (GSAP ScrollTrigger):
// barra de progreso, títulos con máscara, números en parallax, visuales que
// escalan, galería horizontal con pin y pasos que entran desde los lados.
export default function Landing({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const go = () => { if (q.trim()) onSearch(q.trim()); };

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      // barra de progreso de scroll (arriba)
      gsap.to('.land-progress', {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom bottom', scrub: true },
      });

      // reveals genéricos (fade + subida)
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.from(el, {
          opacity: 0, y: 46, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 86%' },
        });
      });

      // títulos que suben desde detrás de una máscara
      gsap.utils.toArray<HTMLElement>('.mh').forEach((el) => {
        gsap.from(el, {
          yPercent: 115, duration: 1, ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 90%' },
        });
      });

      // parallax lento
      gsap.utils.toArray<HTMLElement>('.parallax').forEach((el) => {
        gsap.to(el, { yPercent: -12, ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
      });

      // números gigantes en parallax (van más rápido que el texto)
      gsap.utils.toArray<HTMLElement>('.lf-num').forEach((el) => {
        gsap.to(el, { yPercent: -60, ease: 'none',
          scrollTrigger: { trigger: el.closest('.land-feat'), start: 'top bottom', end: 'bottom top', scrub: true } });
      });

      // visuales que escalan y aparecen al entrar
      gsap.utils.toArray<HTMLElement>('.lf-visual').forEach((el) => {
        gsap.fromTo(el, { scale: 0.8, opacity: 0.35 }, { scale: 1, opacity: 1, ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 45%', scrub: true } });
      });

      // el grafo gira SOLO con el scroll
      const g = root.current?.querySelector('.mock-graph');
      if (g) gsap.to(g, { rotate: 300, ease: 'none',
        scrollTrigger: { trigger: g, start: 'top bottom', end: 'bottom top', scrub: 1 } });

      // pasos que entran alternando desde izquierda/derecha
      gsap.utils.toArray<HTMLElement>('.step').forEach((el, i) => {
        gsap.from(el, { xPercent: i % 2 ? 40 : -40, opacity: 0, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%' } });
      });

      // GALERÍA HORIZONTAL con pin: se desplaza en horizontal al hacer scroll
      const t = track.current;
      if (t) {
        const len = () => t.scrollWidth - window.innerWidth;
        gsap.to(t, {
          x: () => -len(), ease: 'none',
          scrollTrigger: {
            trigger: '.land-gallery', start: 'top top', end: () => '+=' + len(),
            scrub: 1, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
          },
        });
      }
    }, root);
    return () => ctx.revert();
  }, []);

  const tilt = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 16}deg) rotateX(${-y * 16}deg)`;
  };
  const untilt = (e: MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = ''; };

  const search = (
    <div className="land-search reveal">
      <input className="url-input" placeholder="Busca un artista…" value={q}
        onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') go(); }} />
      <button className="btn-remix" onClick={go}>► ENTRAR</button>
    </div>
  );

  return (
    <div className="land" ref={root}>
      <div className="land-progress" />

      {/* HERO */}
      <section className="land-hero">
        <div className="neo-kicker reveal">descubre · explora · conviértelo en <b>póster</b></div>
        <h1 className="neo-title reveal" data-text="CHUPITBEATS">CHUPITBEATS</h1>
        <p className="neo-sub reveal">
          Busca un artista y conviértelo en un <b>póster editorial</b>: su historia,
          su <b>mapa de colaboraciones</b> y los <b>emergentes</b> que suenan como él.
        </p>
        {search}
        <div className="presets reveal">
          <span className="muted">prueba:</span>
          {PRESETS.map(p => <button key={p} className="preset-chip" onClick={() => onSearch(p)}>{p}</button>)}
        </div>
        <div className="land-scroll">↓ scroll</div>
      </section>

      {/* banda marquee */}
      <div className="land-marquee" aria-hidden>
        <div className="mq-track">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>
              DESCUBRE <b>★</b> POR SONIDO <b>★</b> CONVIÉRTELO EN PÓSTER <b>★</b> EXPLORA LA RED <b>★</b> EMERGENTES <b>★</b>{' '}
            </span>
          ))}
        </div>
      </div>

      {/* 01 · sonido */}
      <section className="land-feat">
        <div className="lf-text">
          <span className="lf-num">01</span>
          <h2 className="mask-h"><span className="mh">Descubre por <em>sonido</em></span></h2>
          <p className="reveal">Analizamos el audio real de un artista (no metadatos) y te sacamos artistas emergentes que suenan como él.</p>
        </div>
        <div className="lf-visual parallax">
          <div className="eq">{Array.from({ length: 11 }).map((_, i) => <span key={i} style={{ animationDelay: `${i * 0.09}s` }} />)}</div>
        </div>
      </section>

      {/* 02 · póster */}
      <section className="land-feat alt">
        <div className="lf-text">
          <span className="lf-num">02</span>
          <h2 className="mask-h"><span className="mh">Conviértelo en <em>póster</em></span></h2>
          <p className="reveal">Cada artista se vuelve un póster editorial neo-psicodélico: su foto, sus datos y una frase generada por IA. Descárgalo y compártelo.</p>
        </div>
        <div className="lf-visual">
          <div className="mock-poster tilt" onMouseMove={tilt} onMouseLeave={untilt}>
            <span className="mp-star" />
            <span className="mp-name">TU<br />ARTISTA</span>
          </div>
        </div>
      </section>

      {/* GALERÍA HORIZONTAL con pin */}
      <section className="land-gallery">
        <div className="gallery-track" ref={track}>
          <div className="g-intro">
            <span className="lf-num">★</span>
            <h2 className="mask-h"><span className="mh">Un póster<br />por artista</span></h2>
            <p>desliza →</p>
          </div>
          {GALLERY.map(({ name, tpl }) => (
            <PosterCard key={name} name={name} tplId={tpl} onOpen={() => onSearch(name)} />
          ))}
        </div>
      </section>

      {/* 03 · red */}
      <section className="land-feat">
        <div className="lf-text">
          <span className="lf-num">03</span>
          <h2 className="mask-h"><span className="mh">Explora la <em>red</em></span></h2>
          <p className="reveal">Un mapa de colaboraciones tipo constelación: salta de artista en artista a través de sus features.</p>
        </div>
        <div className="lf-visual parallax">
          <div className="mock-graph">
            <span className="mg-center" />
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className="mg-node" style={{ transform: `rotate(${i * 40}deg) translateX(92px)` }} />
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA · pasos desde los lados */}
      <section className="land-steps">
        <h2 className="mask-h reveal"><span className="mh">Cómo funciona</span></h2>
        <div className="steps-grid">
          {STEPS.map(([n, t, d]) => (
            <div className="step" key={n}>
              <span className="step-n">{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="land-cta reveal">
        <h2>Busca tu artista</h2>
        {search}
      </section>
    </div>
  );
}
