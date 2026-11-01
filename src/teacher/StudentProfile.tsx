import { useEffect, useRef, useState } from 'react';
import { useLive } from '../live/LiveContext';
import { forecast, forecastSeries, projection } from '../live/study/estimate';
import type { StudentProfile as Profile } from '../live/types';
import { ASSESSMENTS, EXAM_DAY, shortDate } from '../scenario/course';
import { ForecastChart, type ChartMarker } from './ForecastChart';
import { EvidenceList } from './LivePanel';
import { Avatar, Button, Eyebrow } from './parts';
import { chatsAbout, interventionsOf, messagesOf, practiceSessions, PROFILE_TABS, tabFor, type ProfileTab } from './profile';
import { LIT, MessageRow } from './voiceParts';

const SHORT: Record<string, string> = { quiz1: 'Quiz 1', a1: 'A1', quiz2: 'Quiz 2', a2: 'A2', quiz3: 'Quiz 3', exam: 'Exam' };

export interface ProfileProps {
  studentId: string;
  entryId: string | null;
  onClose(): void;
  onAsk(s: Profile): void;
  onOpenChat(conversationId: string): void;
}

/** One student's full picture over the teacher screen. Local UI only: nothing is posted, no tokens are spent. */
export function StudentProfile({ studentId, entryId, onClose, onAsk, onOpenChat }: ProfileProps) {
  const live = useLive();
  const s = live?.state.students.find((x) => x.id === studentId);
  const [tab, setTab] = useState<ProfileTab>(() => (s ? tabFor(s, entryId) : 'messages'));
  const hi = useRef<HTMLElement | null>(null);
  useEffect(() => { if (s) setTab(tabFor(s, entryId)); }, [studentId, entryId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { hi.current?.scrollIntoView?.({ block: 'center' }); }, [tab, entryId]);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!live || !s) return null;

  const state = live.state;
  const rec = state.study[s.id];
  const now = forecast(s, rec);
  const lit = (id: string) => id === entryId;
  const keep = (id: string) => (id === entryId ? (el: HTMLElement | null) => { hi.current = el; } : undefined);
  const markers: ChartMarker[] = [
    ...ASSESSMENTS.map((a) => ({ day: a.day, label: SHORT[a.id] ?? a.title, row: 'assessment' as const })),
    ...state.plans
      .filter((p) => p.studentIds.includes(s.id) && ['sent', 'autoApproved', 'done', 'approved'].includes(p.status) && p.kind !== 'classActivity')
      .map((p) => ({ day: p.date, label: p.kind === 'pathway' ? 'Pathway' : 'Check-in', row: 'intervention' as const })),
    ...(rec?.replans ?? []).filter((r) => r.signal === 'disengaged').map((r) => ({ day: r.day, label: 'Stopped', row: 'intervention' as const })),
  ];
  const series = forecastSeries(s, rec);
  const points = rec ? [...series.filter((p) => p.day !== state.day), { day: state.day, value: now.value }] : series;
  const empty = (text: string) => <div className="py-6 text-[14px] text-egg-mute">{text}</div>;

  const body = (() => {
    switch (tab) {
      case 'messages': {
        const list = messagesOf(s);
        return list.length ? <ul className="divide-y divide-egg-line">{list.map((e) => <MessageRow key={e.id} e={e} lit={lit(e.id)} rowRef={keep(e.id)} />)}</ul> : empty('No messages yet');
      }
      case 'chats': {
        const list = chatsAbout(state, s.id);
        return list.length ? (
          <ul className="divide-y divide-egg-line">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onOpenChat(c.id)} className="block w-full py-2.5 text-left hover:bg-egg-card/60">
                  <span className="block text-[14px] font-semibold text-egg-ink">{c.title}</span>
                  <span className="block text-[12.5px] text-egg-mute">{c.first}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : empty(`No AI chats about ${s.short} yet`);
      }
      case 'practice': {
        const list = practiceSessions(state, s);
        return list.length ? (
          <ul className="divide-y divide-egg-line">
            {list.map((p) => {
              const on = entryId !== null && p.entryIds.includes(entryId);
              return (
                <li key={p.key} ref={on ? (el) => { hi.current = el; } : undefined} data-entry={on ? entryId : undefined} className="py-2.5" style={on ? LIT : undefined}>
                  <span className="block font-mono text-[10.5px] uppercase tracking-wide text-egg-mute">{`${shortDate(p.day)} · ${p.concepts.join(', ')}`}</span>
                  <span className="block text-[14px] font-semibold text-egg-ink">{p.title}</span>
                  <span className="block text-[12.5px] text-egg-mute">{`${p.right} right · ${p.wrong} wrong tr${p.wrong === 1 ? 'y' : 'ies'}${p.skipped ? ` · ${p.skipped} skipped` : ''}`}</span>
                </li>
              );
            })}
          </ul>
        ) : empty('No practice on the phone yet');
      }
      case 'interventions': {
        const list = interventionsOf(state, s);
        return list.length ? (
          <ul className="divide-y divide-egg-line">
            {list.map((r) => (
              <li key={r.id} className="py-2.5">
                <span className="block font-mono text-[10.5px] uppercase tracking-wide text-egg-mute">{`${r.kind} · ${r.date} · ${r.status}`}</span>
                <span className="block text-[14px] font-semibold text-egg-ink">{r.title}</span>
                {r.change && <span className="block text-[12.5px] text-egg-mute">{r.change}</span>}
              </li>
            ))}
          </ul>
        ) : empty('No interventions yet');
      }
      case 'record':
        return (
          <>
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-left font-mono text-[10.5px] uppercase tracking-wide text-egg-mute"><th className="py-1.5 font-normal">Subject</th><th className="font-normal">Term</th><th className="font-normal">Grade</th><th className="font-normal">Letter</th></tr>
              </thead>
              <tbody className="divide-y divide-egg-line">
                {s.history.map((h) => (
                  <tr key={h.subject} className="text-egg-ink"><td className="py-2">{h.subject}</td><td className="text-egg-mute">{h.term}</td><td className="tabular-nums">{h.grade.toFixed(1)}</td><td>{h.letter}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[13.5px] font-semibold text-egg-ink">{`GPA ${s.gpa.toFixed(2)} of 4`}</div>
            <ul className="mt-3 divide-y divide-egg-line">{s.evidence.filter((e) => e.kind === 'record').map((e) => <MessageRow key={e.id} e={e} lit={lit(e.id)} rowRef={keep(e.id)} />)}</ul>
          </>
        );
      case 'evidence':
        return <EvidenceList entries={s.evidence} highlight={entryId} />;
    }
  })();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-egg-ink/40 p-8 font-sans" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={s.name} className="flex max-h-full w-[920px] flex-col overflow-hidden rounded-3xl bg-egg-bg text-egg-ink shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-4 border-b border-egg-line px-7 py-5">
          <Avatar name={s.name} size={52} accent={s.status === 'highRisk'} />
          <div className="min-w-0">
            <div className="text-[20px] font-semibold">{s.name}</div>
            <div className="text-[13px] text-egg-mute">{`Discrete Mathematics · Group ${s.group} · GPA ${s.gpa.toFixed(2)}`}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full border border-egg-line px-2.5 py-0.5 text-[12px]">{`Forecast ${now.value.toFixed(1)} · ${now.band}`}</span>
            <Button kind="primary" onClick={() => onAsk(s)}>{`Ask about ${s.short}`}</Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7">
          <div className="mt-5">
            <Eyebrow>Forecast out of 10 · an estimate</Eyebrow>
            <ForecastChart points={points} projection={rec?.plan ? { day: EXAM_DAY, value: projection(s, rec, state.day) } : null} markers={markers} />
          </div>
          <div className="mt-5 flex gap-1 border-b border-egg-ink/80">
            {PROFILE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'true' : undefined}
                className={`rounded-t-lg px-3 py-1.5 text-[13px] ${tab === t.id ? 'bg-egg-ink text-egg-card' : 'text-egg-mute hover:text-egg-ink'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-2">{body}</div>
        </div>
      </div>
    </div>
  );
}
