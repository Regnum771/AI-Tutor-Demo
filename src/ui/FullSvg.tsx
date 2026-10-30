import type { ReactNode } from 'react';

/** Canvas-sized, click-through SVG layer for conduits and particles (coordinates = canvas px). */
export function FullSvg({ children, width = 1920, height = 1080 }: { children: ReactNode; width?: number; height?: number }) {
  return (
    <svg className="pointer-events-none absolute left-0 top-0" width={width} height={height} style={{ overflow: 'visible' }}>
      {children}
    </svg>
  );
}
