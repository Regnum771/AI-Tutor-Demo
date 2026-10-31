import type { ReactNode } from 'react';
import { initials } from '../scenario/classroom';

/** Six-armed asterisk from the reference list markers; the assistant's mark. */
export function Asterisk({ size = 18, className = 'text-egg-orange' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      {[0, 60, 120].map((a) => (
        <rect key={a} x="10.6" y="1" width="2.8" height="22" rx="1.4" fill="currentColor" transform={`rotate(${a} 12 12)`} />
      ))}
    </svg>
  );
}

export function Arrow({ size = 16, dir = 'up' }: { size?: number; dir?: 'up' | 'right' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden style={{ transform: dir === 'right' ? 'rotate(90deg)' : undefined }}>
      <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type SourceKey = 'lms' | 'zalo' | 'whatsapp' | 'email' | 'quiz' | 'records' | 'attendance';

const SOURCE_LABEL: Record<SourceKey, string> = {
  lms: 'LMS', zalo: 'Zalo', whatsapp: 'WhatsApp', email: 'Email', quiz: 'Quiz 2', records: 'Records', attendance: 'Attendance',
};

/** Inline citation: where a fact came from. */
export function Src({ k }: { k: SourceKey }) {
  return (
    <span className="mx-0.5 inline-flex translate-y-[-1px] items-center gap-1 rounded-full border border-egg-line bg-egg-card px-2 py-px align-middle font-mono text-[10.5px] uppercase tracking-wide text-egg-mute">
      <span className="h-1.5 w-1.5 rounded-full bg-egg-orange" />
      {SOURCE_LABEL[k]}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-egg-mute">{children}</div>;
}

export type Level = 'highRisk' | 'support' | 'personal';
const LEVEL: Record<Level, { label: string; cls: string }> = {
  highRisk: { label: 'High risk', cls: 'bg-egg-orange text-egg-ink' },
  support: { label: 'Needs support', cls: 'bg-egg-tint text-egg-ink' },
  personal: { label: 'Needs you', cls: 'bg-egg-ink text-egg-card' },
};

export function LevelChip({ level }: { level: Level }) {
  const l = LEVEL[level];
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${l.cls}`}>{l.label}</span>;
}

export function Avatar({ name, size = 32, accent = false }: { name: string; size?: number; accent?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${accent ? 'bg-egg-orange text-egg-ink' : 'border border-egg-line bg-egg-card text-egg-ink'}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

/** Single-series mastery meter with the 0.50 gap threshold marked. Below threshold reads "gap" in text, not colour alone. */
export function Meter({ label, value, threshold = 0.5 }: { label: string; value: number; threshold?: number }) {
  const gap = value < threshold;
  return (
    <div className="group grid grid-cols-[132px_1fr_64px] items-center gap-3 py-[5px]" title={`${label}: ${value.toFixed(2)} mastery`}>
      <div className="truncate text-[13px] text-egg-ink">{label}</div>
      <div className="relative h-2 rounded-full bg-egg-line/60">
        <div className={`absolute inset-y-0 left-0 rounded-full ${gap ? 'bg-egg-orange' : 'bg-egg-ink'}`} style={{ width: `${value * 100}%` }} />
        <div className="absolute -top-1 h-4 w-px bg-egg-ink/50" style={{ left: `${threshold * 100}%` }} />
      </div>
      <div className="text-right font-mono text-[12px] tabular-nums text-egg-ink">
        {value.toFixed(2)}
        {gap && <span className="ml-1 text-egg-mute">gap</span>}
      </div>
    </div>
  );
}

export function Button({ children, kind = 'ghost', onClick }: { children: ReactNode; kind?: 'primary' | 'dark' | 'ghost'; onClick?: () => void }) {
  const cls = {
    primary: 'bg-egg-orange text-egg-ink hover:brightness-95',
    dark: 'bg-egg-ink text-egg-card hover:bg-black',
    ghost: 'border border-egg-ink/25 text-egg-ink hover:border-egg-ink',
  }[kind];
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${cls}`}>
      {children}
    </button>
  );
}
