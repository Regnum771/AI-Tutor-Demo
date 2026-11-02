import { useState } from 'react';
import type { ReviewRow, ReviewView } from '../liveView';

function Details({ row }: { row: ReviewRow }) {
  if (row.hints.length === 0 && !row.guided) return <div className="px-4 pb-3 text-[13.5px] text-egg-mute">Right first try: nothing more to show.</div>;
  return (
    <div className="space-y-2 px-4 pb-3 text-[13.5px] leading-snug">
      {row.hints.map((h) => (
        <div key={h.option}>
          <span className="font-mono">{h.option}</span>
          <span className="text-egg-mute">{` · ${h.hint}`}</span>
        </div>
      ))}
      {row.guided && (
        <div>
          <div className="font-mono">{row.guided.start}</div>
          {row.guided.steps.map((s, i) => (
            <div key={s.expr} className="mt-1">
              <div className="font-mono text-[12px] text-egg-mute">{`Step ${i + 1} · ${s.why}`}</div>
              <div className="font-mono">{`≡ ${s.expr}`}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The end of every session: each question with its tries in order. A row expands into its hints and worked steps. */
export function ReviewScreen({ view, onContinue }: { view: ReviewView; onContinue(): void }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="absolute inset-0 overflow-y-auto bg-egg-bg px-5 pb-8 pt-14 font-sans text-egg-ink">
      <div className="text-[28px] font-bold">Review</div>
      <div className="mt-1 text-[14px] text-egg-mute">{view.summary}</div>
      <ul className="mt-4 space-y-2.5">
        {view.rows.map((r, i) => (
          <li key={i} data-review-row={i} className="rounded-2xl border border-egg-line bg-egg-card">
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="w-full p-4 text-left">
              <span className="block text-[15px] font-semibold leading-snug">{r.prompt}</span>
              <span className="mt-1.5 block font-mono text-[13px] text-egg-mute">{r.tries.map((t) => `${t.right ? '✓' : '✗'} ${t.option}`).join(', then ')}</span>
              <span className="mt-1 block text-[13px] text-egg-mute">{`Answer: ${r.answer}`}</span>
            </button>
            {open === i && <Details row={r} />}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onContinue} className="mt-5 w-full rounded-full bg-egg-ink py-3 text-[15px] font-semibold text-egg-card">Continue</button>
    </div>
  );
}
