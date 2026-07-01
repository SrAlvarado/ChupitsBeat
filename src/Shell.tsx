import { useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import History from './History';
import Landing from './Landing';
import Backdrop3D from './Backdrop3D';
import './remix.css';
import './neo.css';

gsap.registerPlugin(ScrollTrigger);
const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Shell() {
  // ?a=Artista entra directo; si no, landing.
  const [query, setQuery] = useState<string | null>(
    () => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('a')) || null);

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

  return (
    <div className="neo-root neo-corners">
      <div className="neo-grid" />
      {!reduced && <Backdrop3D />}
      <div className="neo-blobs" />
      <div className="neo-scan" />
      <div className="neo-grain" />

      <header className="neo-bar">
        <span>CHUPITBEATS<span className="dot"> ●</span> SYS.ONLINE</span>
        <span>ACID//ASCII · 44.1kHz</span>
      </header>

      {query === null ? (
        <Landing onSearch={setQuery} />
      ) : (
        <>
          <button className="neo-back" onClick={() => setQuery(null)}>← INICIO</button>
          <History initialQuery={query} />
        </>
      )}
    </div>
  );
}
