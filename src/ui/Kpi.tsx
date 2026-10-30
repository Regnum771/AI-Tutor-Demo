import { C } from './tokens';

export function Kpi({ label, value, color = C.ink }: { label: string; value: number | string; color?: string }) {
  return (
    <div>
      <div className="font-display text-[64px] font-extrabold leading-none" style={{ color }}>{value}</div>
      <div className="mt-2 text-[18px] text-dim">{label}</div>
    </div>
  );
}
