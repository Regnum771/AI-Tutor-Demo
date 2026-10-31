import { useState } from 'react';
import { lerp } from '../engine/anim';
import { COMPLEX, GROUPS, HEATMAP, SCALE_STUDENTS, STUDENTS, TOPICS, groupOf, type Student } from '../scenario/classroom';
import { conceptById } from '../scenario/knowledgeGraph';
import { egg } from '../ui/theme';
import { MASTERY_INITIAL, MASTERY_POST, MINH_ANH, TWIN_FOCUS } from '../scenario/minhAnh';
import type { FrameClassroom } from './frame';
import type { TeacherActions } from './TeacherScreen';
import { Avatar, Button, Eyebrow, LevelChip, Mark, Meter, type Level } from './parts';

type Band = 'onTrack' | Level;
type Filter = 'all' | Band;

/** One status per student: escalated students read as "needs you" rather than high risk. */
const bandOf = (s: Student): Band => (COMPLEX.includes(s.index) ? 'personal' : s.status);
const shortName = (s: Student) => (s.index === MINH_ANH.index ? MINH_ANH.short : s.name.split(' ').slice(-1)[0]);

/** Students who move band once the adapted pathway lands (adapt >= 0.5), derived from the data so counts always agree. */
const ADAPT_SUPPORT_TO_ON_TRACK = 3; // need support 12 -> 9
const escalated = (s: Student) => COMPLEX.includes(s.index);
const toSupport = new Set(STUDENTS.filter((s) => s.status === 'highRisk' && !escalated(s)).map((s) => s.index));
const toOnTrack = new Set(
  STUDENTS.filter((s) => s.status === 'support' && !escalated(s))
    .sort((x, y) => y.mastery - x.mastery || x.index - y.index)
    .slice(0, ADAPT_SUPPORT_TO_ON_TRACK)
    .map((s) => s.index),
);
export const adaptedBand = (s: Student, a: number): Band => {
  if (a >= 0.5 && toSupport.has(s.index)) return 'support';
  if (a >= 0.5 && toOnTrack.has(s.index)) return 'onTrack';
  return bandOf(s);
};
export const adaptedMastery = (s: Student, a: number): number => {
  if (s.index === MINH_ANH.index) return lerp(MASTERY_INITIAL.equivalence, MASTERY_POST.equivalence, a);
  if (toSupport.has(s.index)) return lerp(s.mastery, 0.55, a);
  if (toOnTrack.has(s.index)) return lerp(s.mastery, 0.6, a);
  return s.mastery;
};
/** Students not on track (the "need support" headline), unmultiplied. */
export const needSupportAt = (a: number) => STUDENTS.filter((s) => adaptedBand(s, a) !== 'onTrack').length;
const highRiskAt = (a: number) => STUDENTS.filter((s) => ['highRisk', 'personal'].includes(adaptedBand(s, a))).length;

const BAND: Record<Band, { label: string; cell: string; mark: string }> = {
  onTrack: { label: 'On track', cell: 'border-egg-line bg-egg-card text-egg-ink', mark: '' },
  support: { label: 'Needs support', cell: 'border-transparent bg-egg-risk-tint text-egg-ink', mark: 'Support' },
  highRisk: { label: 'High risk', cell: 'border-transparent bg-egg-risk text-egg-ink', mark: 'Risk' },
  personal: { label: 'Needs you', cell: 'border-transparent bg-egg-ink text-egg-card', mark: 'You' },
};
/** Fixed risk colour (egg-risk, #FF5B1F) for the High risk pulse ring and the gap heatmap. */
const risk = (a: number) => `rgb(255 91 31 / ${a})`;
const BANDS: Band[] = ['highRisk', 'personal', 'support', 'onTrack'];
/** Every student on a routine, adaptive or teacher-led track. */
const RUNNING_TOTAL = STUDENTS.filter((s) => s.track !== 'none').length;

/** Scripted frames cap the Interventions list so the Classroom fits the canvas with room for the overlays. */
const SCRIPTED_ROWS = 4;

const TRACK_LABEL: Record<Student['track'], string> = {
  routine: 'Routine practice', adaptive: 'Adaptive pathway', complex: 'Paused · teacher check-in', none: 'No intervention',
};

/** Running interventions: Minh Anh's pending proposal first, then the scale examples. */
const RUNNING = [
  { index: MINH_ANH.index, what: 'Rebuild implication, then equivalence', state: 'Awaiting you' },
  ...SCALE_STUDENTS.map((s) => ({ index: s.index, what: `${s.need} → ${s.intervention}`, state: COMPLEX.includes(s.index) ? 'Needs you' : 'Running' })),
];

interface ClassroomProps {
  cls: FrameClassroom;
  /** Minh Anh's proposal has been approved: her intervention is running. */
  studentApproved?: boolean;
  actions?: TeacherActions;
}

export function Classroom({ cls, studentApproved = false, actions }: ClassroomProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const a = cls.adapt;
  const k = cls.kpi;
  const avg = STUDENTS.reduce((sum, s) => sum + adaptedMastery(s, a), 0) / STUDENTS.length;
  const count = (b: Band) => STUDENTS.filter((s) => adaptedBand(s, a) === b).length;
  const pick = (i: number) => actions?.select(cls.selected === i ? null : i);
  const needSupport = Math.round(needSupportAt(a) * k);
  const scripted = !actions;
  const rows = scripted ? RUNNING.slice(0, SCRIPTED_ROWS) : RUNNING;
  const tileH = scripted ? 'h-[70px]' : 'h-[78px]';

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={scripted ? 'px-8 pb-6 pt-4' : 'px-8 pb-10 pt-6'}>
        <div className="flex items-end gap-6">
          <div>
            <Eyebrow>Discrete Mathematics · DM-2026 · Week 6</Eyebrow>
            <h2 className="mt-2 font-serif text-[56px] leading-[0.95]">
              55 students, <span className="text-egg-accent-ink">{needSupport}</span> need support
            </h2>
          </div>
          <div className="ml-auto flex gap-2 pb-1">
            <Button>Export</Button>
            <Button kind="primary" onClick={() => actions?.askClass()}><Mark size={13} className="text-egg-ink" /> Ask about the class</Button>
          </div>
        </div>

        <div className={`${scripted ? 'mt-4' : 'mt-6'} grid grid-cols-5 border-y-2 border-egg-ink`}>
          {[
            { label: 'Students', value: String(Math.round(55 * k)) },
            { label: 'Need support', value: String(needSupport), accent: true },
            { label: 'High risk', value: String(Math.round(highRiskAt(a) * k)), note: `${COMPLEX.length} escalated to you` },
            { label: 'Running', value: String(Math.round(RUNNING_TOTAL * k)), note: 'interventions, 0 overdue' },
            { label: 'Avg. mastery', value: (avg * k).toFixed(2) },
          ].map((kpi, i) => (
            <div key={kpi.label} className={`${scripted ? 'py-3' : 'py-4'} ${i ? 'border-l border-egg-line pl-5' : ''}`}>
              <Eyebrow>{kpi.label}</Eyebrow>
              <div className={`mt-1 font-serif text-[52px] leading-none ${kpi.accent ? 'text-egg-accent-ink' : ''}`}>{kpi.value}</div>
              {'note' in kpi && <div className="mt-1 text-[12px] text-egg-mute" style={{ opacity: k }}>{kpi.note}</div>}
            </div>
          ))}
        </div>

        <div className={`${scripted ? 'mt-5' : 'mt-7'} grid grid-cols-[1fr_440px] gap-8`}>
          <section>
            <div className="flex items-center gap-2 border-b border-egg-ink/80 pb-2">
              <h3 className="mr-3 font-serif text-[26px] leading-none">Students</h3>
              {(['all', ...BANDS] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] ${filter === f ? 'bg-egg-ink text-egg-card' : 'text-egg-mute hover:text-egg-ink'}`}
                >
                  {f !== 'all' && <span className={`h-2.5 w-2.5 rounded-full border ${BAND[f].cell}`} />}
                  {f === 'all' ? `All ${STUDENTS.length}` : `${BAND[f].label} ${count(f)}`}
                </button>
              ))}
              <span className="ml-auto text-[12px] text-egg-mute">number = mastery · gap below 0.50</span>
            </div>
            <div className="mt-4 grid grid-cols-11 gap-2">
              {STUDENTS.map((s, i) => {
                if (i >= cls.tiles) return <div key={s.id} className={`${tileH} rounded-xl border border-dashed border-egg-line bg-transparent`} />;
                const isMinh = s.index === MINH_ANH.index;
                const b = adaptedBand(s, a);
                const dim = filter !== 'all' && filter !== b;
                const mastery = adaptedMastery(s, a);
                const glow = isMinh && cls.pulse > 0 && cls.selected !== s.index;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick(s.index)}
                    title={`${s.name} · ${BAND[b].label} · mastery ${mastery.toFixed(2)}`}
                    className={`flex ${tileH} flex-col justify-between rounded-xl border p-2 text-left ${BAND[b].cell} ${dim ? 'opacity-20' : ''} ${cls.selected === s.index ? 'outline outline-2 outline-offset-2 outline-egg-ink' : ''}`}
                    style={glow ? { boxShadow: `0 0 0 ${2 + 6 * cls.pulse}px ${risk(0.35 + 0.4 * cls.pulse)}` } : undefined}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[10.5px] font-semibold opacity-70">{BAND[b].mark}</span>
                      <span className="font-mono text-[11px] tabular-nums">{mastery.toFixed(2)}</span>
                    </div>
                    <div className="truncate text-[13px] font-semibold leading-tight">{shortName(s)}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className={scripted ? 'space-y-5' : 'space-y-8'}>
            {cls.selected !== null ? (
              <StudentCard s={STUDENTS[cls.selected]} adapt={a} appear={cls.selectAppear} actions={actions} />
            ) : (
              cls.kpi > 0 && (
                <section>
                  <div className="flex items-baseline justify-between border-b border-egg-ink/80 pb-2">
                    <h3 className="font-serif text-[26px] leading-none">Interventions</h3>
                    <span className="text-[12px] text-egg-mute">agents running · you approve</span>
                  </div>
                  <ul className="divide-y divide-egg-line">
                    {rows.map((row) => {
                      const r = row.index === MINH_ANH.index && studentApproved ? { ...row, state: 'Running' } : row;
                      const s = STUDENTS[r.index];
                      return (
                        <li key={r.index}>
                          <button type="button" onClick={() => pick(r.index)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-egg-card/60">
                            <Avatar name={s.name} size={30} accent={r.index === MINH_ANH.index} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-semibold">{s.name}</span>
                              <span className="block truncate text-[12.5px] text-egg-mute">{r.what}</span>
                            </span>
                            <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${r.state === 'Running' ? 'border border-egg-line text-egg-mute' : r.state === 'Needs you' ? 'bg-egg-ink text-egg-card' : 'bg-egg-risk text-egg-ink'}`}>
                              {r.state}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {rows.length < RUNNING.length && <div className="border-t border-egg-line pt-1.5 text-[12px] text-egg-mute">+{RUNNING.length - rows.length} more running</div>}
                </section>
              )
            )}
            {cls.kpi > 0 && <Heatmap compact={scripted} />}
          </aside>
        </div>
      </div>
    </div>
  );
}

/** Topic × group mastery. One fixed hue in every theme: the more orange, the bigger the gap. Values are always printed. */
function Heatmap({ compact }: { compact: boolean }) {
  const tint = (v: number) => Math.max(0, Math.min(1, (0.9 - v) / 0.5)) * 100;
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-egg-ink/80 pb-2">
        <h3 className="font-serif text-[26px] leading-none">Topics × groups</h3>
        <span className="text-[12px] text-egg-mute">more orange = bigger gap</span>
      </div>
      <table className="mt-2 w-full border-separate border-spacing-[3px] text-[12px]">
        <thead>
          <tr>
            <th />
            {GROUPS.map((g) => <th key={g} className="pb-1 text-center font-mono font-normal text-egg-mute">{g}</th>)}
          </tr>
        </thead>
        <tbody>
          {TOPICS.map((t, r) => (
            <tr key={t}>
              <td className="whitespace-nowrap pr-2 text-[12.5px] text-egg-ink">{t}</td>
              {HEATMAP[r].map((v, c) => (
                <td
                  key={c}
                  title={`${t} · ${GROUPS[c]}: ${v.toFixed(2)} mastery`}
                  className={`${compact ? 'h-7' : 'h-8'} rounded-md text-center font-mono tabular-nums text-egg-ink ${v < 0.5 ? 'font-bold' : ''}`}
                  style={{ background: `color-mix(in oklab, ${risk(1)} ${tint(v)}%, ${egg('card')})` }}
                >
                  {v.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StudentCard({ s, adapt, appear, actions }: { s: Student; adapt: number; appear: number; actions?: TeacherActions }) {
  const b = adaptedBand(s, adapt);
  const isMinhAnh = s.index === MINH_ANH.index;
  return (
    <section className="rounded-2xl border-2 border-egg-ink bg-egg-card p-5" style={{ opacity: appear }}>
      <div className="flex items-center gap-3">
        <Avatar name={s.name} size={46} accent={b === 'highRisk'} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[18px] font-semibold">{s.name}</div>
          <div className="text-[12.5px] text-egg-mute">Group {groupOf(s.index)} · {TRACK_LABEL[s.track]}</div>
        </div>
        {b === 'onTrack' ? <span className="rounded-full border border-egg-line px-2.5 py-0.5 text-[11.5px] text-egg-mute">On track</span> : <LevelChip level={b} />}
      </div>
      <div className="mt-4 border-t border-egg-line pt-3">
        {isMinhAnh ? (
          TWIN_FOCUS.map((c) => <Meter key={c} label={conceptById(c).label} value={lerp(MASTERY_INITIAL[c], MASTERY_POST[c], adapt)} />)
        ) : (
          <Meter label="Overall mastery" value={s.mastery} />
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <Button kind="primary" onClick={() => actions?.askStudent(s)}>
          <Mark size={13} className="text-egg-ink" /> Ask about {shortName(s)}
        </Button>
        <Button onClick={() => actions?.select(null)}>Close</Button>
      </div>
    </section>
  );
}
