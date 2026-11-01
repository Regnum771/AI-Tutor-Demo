import type { Evidence } from '../live/types';
import { lectureLabel, shortDate } from '../scenario/course';
import { voiceFor } from '../scenario/voice';
import { egg } from '../ui/theme';

/** The highlight on a cited entry. Both properties: happy-dom drops the `background` shorthand, and the SSR tests match `style="background:`. */
export const LIT = { background: egg('accent', 0.18), backgroundColor: egg('accent', 0.18) };

/** "Zalo · Wed 21 Oct · 21:40 · 1 day after Lecture 5": where and when an entry came from. */
export function metaOf(e: Evidence): string {
  const when = e.day !== undefined && e.time ? `${shortDate(e.day)} · ${e.time} · ${lectureLabel(e.day, e.time)}` : e.when;
  return `${e.source} · ${when}`;
}

/** An entry in the student's words: the original, then the English gist. Spans only, so it fits inside a <p> or a <button>. */
export function Words({ e }: { e: Evidence }) {
  const v = voiceFor(e.id);
  if (!v) return <span className="block text-[14px] text-egg-ink">{e.text}</span>;
  return (
    <>
      {v.vi && <span className="block text-[14px] text-egg-ink">{`“${v.vi}”`}</span>}
      <span className={`block ${v.vi ? 'text-[12.5px] text-egg-mute' : 'text-[14px] text-egg-ink'}`}>{v.vi ? v.gist : `“${v.gist}”`}</span>
    </>
  );
}

export function MessageRow({ e, lit, rowRef }: { e: Evidence; lit: boolean; rowRef?: (el: HTMLLIElement | null) => void }) {
  return (
    <li ref={rowRef} data-entry={e.id} className="py-2.5" style={lit ? LIT : undefined}>
      <span className="block font-mono text-[10.5px] uppercase tracking-wide text-egg-mute">{metaOf(e)}</span>
      <Words e={e} />
    </li>
  );
}

/** A cited message under an answer block: the student's words, then who and when. */
export function QuoteCard({ e, name, onOpen }: { e: Evidence; name: string; onOpen(): void }) {
  const when = e.day !== undefined && e.time ? ` · ${shortDate(e.day)} · ${lectureLabel(e.day, e.time)}` : ` · ${e.when}`;
  return (
    <button type="button" data-quote={e.id} onClick={onOpen} className="mt-2 block w-full rounded-xl border-l-4 border-egg-accent bg-egg-card px-3 py-2 text-left hover:bg-egg-tint">
      <Words e={e} />
      <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-wide text-egg-mute">{`${e.source} · ${name}${when}`}</span>
    </button>
  );
}
