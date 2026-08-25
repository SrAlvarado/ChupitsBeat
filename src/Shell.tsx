import { useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import History from './History';
import Landing from './Landing';
import './remix.css';
import './neo.css';
import './y2k.css';

gsap.registerPlugin(ScrollTrigger);
const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Shell() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const [query, setQuery] = useState<string | null>(() => params?.get('a') || null);

  // scroll suave (Lenis) conectado a GSAP ScrollTrigger
  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ lerp: 0.09 });
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(raf); lenis.destroy(); };
  }, []);

  if (query === null) {
    return (
      <div className="app-landing">
        <Landing onSearch={setQuery} />
      </div>
    );
  }

  return (
    <div className="app-landing paper-root">
      <div className="h-nav artist-bar">
        <a className="h-logo" href="#" onClick={e => { e.preventDefault(); setQuery(null); }}>
          <span className="h-dot" />CHUPIT<b>BEATS</b>
        </a>
        <button className="btn-phys" onClick={() => setQuery(null)}>← INICIO</button>
      </div>
      <History initialQuery={query} />
    </div>
  );
}
