import type { CSSProperties, ReactNode } from 'react';
import { C } from './tokens';

export function Panel({ title, accent = C.line, className = '', style, children }: { title?: string; accent?: string; className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div className={`rounded-2xl border-2 p-5 ${className}`} style={{ background: C.panel, borderColor: accent, ...style }}>
      {title && (
        <div className="mb-3 font-display text-[17px] font-bold uppercase tracking-[0.14em]" style={{ color: accent === C.line ? C.dim : accent }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
