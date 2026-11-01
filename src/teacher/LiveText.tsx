import { useLive } from '../live/LiveContext';
import type { LiveBlock, LivePanel } from '../live/types';
import { QuoteCard } from './voiceParts';

/** Where a cited evidence id opens: the class panel, or the student's panel with that entry highlighted. */
export const panelForEvidence = (id: string): LivePanel =>
  id.startsWith('class-') ? { kind: 'class', planId: null, highlight: id } : { kind: 'student', studentId: id.split('-')[0], planId: null, highlight: id };

/** A live answer block: `**bold**` spans, then one chip per cited evidence entry. */
/** `quoted` lists evidence ids already quoted in earlier blocks of the same answer; they get no second card. */
export function LiveText({ block, quoted = [] }: { block: LiveBlock; quoted?: string[] }) {
  const live = useLive();
  const source = (id: string) => {
    const list = id.startsWith('class-') ? live?.state.classEvidence : live?.state.students.find((s) => s.id === id.split('-')[0])?.evidence;
    return list?.find((e) => e.id === id)?.source ?? 'Evidence';
  };
  const open = (id: string) => {
    if (!live) return;
    if (id.startsWith('class-')) live.showPanel(panelForEvidence(id));
    else live.openProfile(id.split('-')[0], id);
  };
  const studentOf = (id: string) => live?.state.students.find((s) => s.id === id.split('-')[0]);
  const quotes = [...new Set(block.cites)]
    .filter((id) => !quoted.includes(id))
    .flatMap((id) => {
      const e = id.startsWith('class-') ? undefined : studentOf(id)?.evidence.find((x) => x.id === id);
      return e?.kind === 'message' ? [e] : [];
    })
    .slice(0, 2);
  return (
    <>
      {block.text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
        part.length > 4 && part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-egg-ink">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>,
      )}
      {block.cites.map((id, i) => (
        <button
          key={`${id}:${i}`}
          type="button"
          data-cite={id}
          onClick={() => open(id)}
          className="mx-0.5 inline-flex translate-y-[-1px] items-center gap-1 rounded-full border border-egg-line bg-egg-card px-2 py-px align-middle font-mono text-[10.5px] uppercase tracking-wide text-egg-mute hover:border-egg-ink hover:text-egg-ink"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-egg-accent" />
          {source(id)}
        </button>
      ))}
      {quotes.map((e) => <QuoteCard key={e.id} e={e} name={studentOf(e.id)?.name ?? ''} onOpen={() => open(e.id)} />)}
    </>
  );
}
