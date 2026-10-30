import { useEffect, useState, type ReactNode } from 'react';

function fitScale(w: number, h: number): number {
  const forced = Number(new URLSearchParams(window.location.search).get('scale'));
  return forced > 0 ? forced : Math.min(window.innerWidth / w, window.innerHeight / h);
}

/** A fixed-size logical canvas, letterboxed and scaled to the window (or to ?scale=N). */
export function Stage({ width, height, background, children }: { width: number; height: number; background: string; children: ReactNode }) {
  const [scale, setScale] = useState(() => fitScale(width, height));
  useEffect(() => {
    const onResize = () => setScale(fitScale(width, height));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [width, height]);
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ width: width * scale, height: height * scale, position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width, height, background, overflow: 'hidden', transform: `scale(${scale})`, transformOrigin: '0 0' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
