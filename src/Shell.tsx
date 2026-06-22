import { useState } from 'react';
import App from './App';
import Remix from './Remix';
import './remix.css';

export default function Shell() {
  const [mode, setMode] = useState<'live' | 'remix'>('remix');
  return (
    <>
      <nav className="mode-switch">
        <button className={mode === 'remix' ? 'on' : ''} onClick={() => setMode('remix')}>🎚 Remix</button>
        <button className={mode === 'live' ? 'on' : ''} onClick={() => setMode('live')}>🎛 Live Coding</button>
      </nav>
      {mode === 'live' ? <App /> : <Remix />}
    </>
  );
}
