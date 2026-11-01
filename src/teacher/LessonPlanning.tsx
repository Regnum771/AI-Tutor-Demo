import { useState } from 'react';
import { fmt } from '../live/clock';
import { useLive } from '../live/LiveContext';
import { fullDate, type Lecture } from '../scenario/course';
import { conceptById, type ConceptId } from '../scenario/knowledgeGraph';
import { resourceById } from '../scenario/materials';
import { ConceptGraph } from './ConceptGraph';
import { MasteryChart } from './MasteryChart';
import { Eyebrow } from './parts';
import { DEFAULT_CONCEPT, masterySeries, pastLectures, planMarkers, upcomingLectures } from './planningModel';
import { ResourceList } from './ResourceList';

const TOGGLE = 'rounded-full border border-egg-line px-3 py-1 text-[12.5px] text-egg-ink hover:border-egg-ink';

/** The coming lectures in one place: the class's concepts, how they moved over the term, and each lecture's materials with who has used them. Live only and a view only: it posts nothing and costs no tokens. */
export function LessonPlanning() {
  const live = useLive();
  const [selected, setSelected] = useState<ConceptId | null>(null);
  // A chip for a past lecture's resource opens with the past lectures showing, so its row is on screen.
  const [showPast, setShowPast] = useState(() => {
    const r = live?.planningResource ? resourceById(live.planningResource) : undefined;
    return !!(live && r && pastLectures(live.state.day, fmt(live.state.clock), null).some((l) => l.n === r.lecture));
  });
  if (!live) return null;
  const { state } = live;
  const time = fmt(state.clock);
  const concept = selected ?? DEFAULT_CONCEPT;
  const label = conceptById(concept).label;
  const upcoming = upcomingLectures(state.day, time, selected);
  const past = pastLectures(state.day, time, selected);

  const lecture = (l: Lecture) => (
    <section key={l.n} data-lecture={l.n} className="mt-5">
      <div className="flex items-baseline gap-3">
        <h4 className="font-serif text-[22px] leading-none">{`Lecture ${l.n} · ${l.title}`}</h4>
        <span className="text-[12.5px] text-egg-mute">{fullDate(l.day)}</span>
      </div>
      <div className="mt-1 text-[12.5px] text-egg-mute">{l.concepts.length ? l.concepts.map((c) => conceptById(c).label).join(' · ') : 'Revision of the whole course'}</div>
      <div className="mt-2"><ResourceList lecture={l.n} initialOpen={live.planningResource} /></div>
    </section>
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1100px] px-8 pb-10 pt-6">
        <Eyebrow>Discrete Mathematics · DM-2026</Eyebrow>
        <section data-section="graph" className="mt-3">
          <div className="flex items-baseline justify-between border-b border-egg-ink/80 pb-2">
            <h3 className="font-serif text-[26px] leading-none">Knowledge graph</h3>
            <span className="text-[12px] text-egg-mute">{selected ? `Showing ${label} · click it again to clear` : 'Class average mastery · click a concept to focus'}</span>
          </div>
          <div className="mt-3"><ConceptGraph state={state} selected={selected} onSelect={setSelected} /></div>
        </section>

        <section data-section="chart" className="mt-8">
          <div className="flex items-baseline justify-between border-b border-egg-ink/80 pb-2">
            <h3 data-chart-title className="font-serif text-[26px] leading-none">{`Mastery over time · ${label}`}</h3>
            <span className="text-[12px] text-egg-mute">{selected ? 'Class average, 0 to 1' : 'Class average, 0 to 1 · the Week 6 topic'}</span>
          </div>
          <div className="mt-3"><MasteryChart concept={concept} label={label} points={masterySeries(state, concept)} markers={planMarkers(state)} /></div>
        </section>

        <section data-section="lectures" className="mt-8">
          <div className="flex items-baseline justify-between border-b border-egg-ink/80 pb-2">
            <h3 className="font-serif text-[26px] leading-none">Upcoming lectures</h3>
            {selected && <span className="text-[12px] text-egg-mute">{`Lectures with material on ${label}`}</span>}
          </div>
          {upcoming.length ? upcoming.map(lecture) : <div className="mt-4 text-[14px] text-egg-mute">No lectures are left.</div>}
          <div className="mt-6">
            <button type="button" aria-expanded={showPast} onClick={() => setShowPast(!showPast)} className={TOGGLE}>
              {showPast ? 'Hide past lectures' : 'Past lectures'}
            </button>
          </div>
          {showPast && (past.length ? past.map(lecture) : <div className="mt-4 text-[14px] text-egg-mute">{selected ? `No other past lecture has material on ${label}.` : 'No lectures yet.'}</div>)}
        </section>
      </div>
    </div>
  );
}
