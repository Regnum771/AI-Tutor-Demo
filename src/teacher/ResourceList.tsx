import { useEffect, useRef, useState } from 'react';
import { fmt } from '../live/clock';
import { useLive } from '../live/LiveContext';
import { LECTURES, shortDate } from '../scenario/course';
import { classEngagement, isReleased, KIND_LABEL, notOpened, resourcesFor, type Resource, type ResourceKind } from '../scenario/materials';

const VERB: Record<ResourceKind, string> = { slides: 'viewed', recording: 'watched', worksheet: 'done', reading: 'read', video: 'watched' };

/** "31 of 55 opened · 46% watched on average", or "Not released yet" before the lecture. */
export function engagementLine(r: Resource, released: boolean, today: number): string {
  if (!released) return 'Not released yet';
  const c = classEngagement(r.id, today);
  return c.opened ? `${c.opened} of ${c.of} opened · ${Math.round(c.meanFraction * 100)}% ${VERB[r.kind]} on average` : `0 of ${c.of} opened`;
}

/** A lecture's materials with class engagement. A row expands into the students who have not opened it; a name opens the profile pop-up. Live only; posts nothing. */
export function ResourceList({ lecture, initialOpen = null }: { lecture: number; initialOpen?: string | null }) {
  const live = useLive();
  const list = resourcesFor(lecture);
  const [open, setOpen] = useState<string | null>(() => (initialOpen && list.some((r) => r.id === initialOpen) ? initialOpen : null));
  const first = useRef<HTMLLIElement | null>(null);
  useEffect(() => { first.current?.scrollIntoView?.({ block: 'center' }); }, []);
  if (!live) return null;
  const { state } = live;
  const time = fmt(state.clock);
  const l = LECTURES[lecture - 1];
  return (
    <ul data-resources={lecture} className="divide-y divide-egg-line border-y border-egg-line">
      {list.map((r) => {
        const released = isReleased(r, state.day, time);
        const expanded = open === r.id;
        const missing = released ? notOpened(r.id, state.day).map((i) => state.students[i]) : [];
        return (
          <li key={r.id} data-resource={r.id} ref={r.id === initialOpen ? first : undefined}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : r.id)}
              className="grid w-full grid-cols-[92px_minmax(0,1fr)_auto] items-baseline gap-3 py-2 text-left hover:bg-egg-card/60"
            >
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-egg-mute">{KIND_LABEL[r.kind]}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-egg-ink">{r.title}</span>
                <span className="block text-[12px] text-egg-mute">{`${r.bloom} · ${r.minutes} min · ${r.source}`}</span>
              </span>
              <span data-engagement className="text-right text-[12px] text-egg-mute">{engagementLine(r, released, state.day)}</span>
            </button>
            {expanded && (
              <div data-not-opened={r.id} className="pb-3 pl-[104px] text-[13px]">
                {!released ? (
                  <span className="text-egg-mute">{`Nobody can open it before Lecture ${l.n} on ${shortDate(l.day)}.`}</span>
                ) : missing.length === 0 ? (
                  <span className="text-egg-mute">Every student has opened it.</span>
                ) : (
                  <>
                    <span className="block text-egg-mute">{`${missing.length} student${missing.length === 1 ? ' has' : 's have'} not opened it`}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {missing.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          data-student={s.id}
                          onClick={() => live.openProfile(s.id)}
                          className="rounded-full border border-egg-line px-2.5 py-0.5 text-[12.5px] text-egg-ink hover:border-egg-ink"
                        >
                          {s.name}
                        </button>
                      ))}
                    </span>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
