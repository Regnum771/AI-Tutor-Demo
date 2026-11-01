import { useState } from 'react';
import { useLive } from '../live/LiveContext';
import { lectureBefore, lectureLabel, shortDate } from '../scenario/course';
import { conceptById } from '../scenario/knowledgeGraph';
import { CHANNEL_LABEL, FAQ, faqLog, faqStats, voiceEvidenceId } from '../scenario/voice';
import { Words } from './voiceParts';

/** The class FAQ, authored in the seed data, with figures computed from the message log. Live only; no tokens. */
export function ClassQuestions() {
  const live = useLive();
  const [open, setOpen] = useState<string | null>(null);
  if (!live) return null;
  const rows = FAQ.map((f) => ({ f, st: faqStats(f.id) })).sort((a, b) => b.st.students - a.st.students);
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-egg-ink/80 pb-2">
        <h3 className="font-serif text-[26px] leading-none">What students are asking</h3>
        <span className="text-[12px] text-egg-mute">Zalo, email, WhatsApp, LMS forum</span>
      </div>
      <ul className="divide-y divide-egg-line">
        {rows.map(({ f, st }) => (
          <li key={f.id}>
            <button type="button" aria-expanded={open === f.id} onClick={() => setOpen(open === f.id ? null : f.id)} className="block w-full py-2.5 text-left hover:bg-egg-card/60">
              <span className="block text-[14px] font-semibold text-egg-ink">{f.question}</span>
              <span className="block text-[12.5px] text-egg-mute">{`${st.students} students · ${st.messages} messages · ${conceptById(f.concept).label} · ${st.timing}`}</span>
            </button>
            {open === f.id && (
              <ul className="mb-3 space-y-2 border-l-2 border-egg-line pl-3">
                {faqLog(f.id).map((v) => {
                  const student = live.state.students[v.studentIndex];
                  const id = voiceEvidenceId(v);
                  const e = student.evidence.find((x) => x.id === id);
                  const lecture = lectureBefore(v.day, v.time);
                  return (
                    <li key={id} data-log-entry={id} className="text-[13px]">
                      <span className="block">
                        <button type="button" onClick={() => live.openProfile(student.id, id)} className="font-semibold text-egg-ink hover:underline">{student.name}</button>
                        <span className="text-egg-mute">{` · ${CHANNEL_LABEL[v.channel]} · ${shortDate(v.day)} · ${v.time}`}</span>
                      </span>
                      {e && <Words e={e} />}
                      <span className="block font-mono text-[10.5px] uppercase tracking-wide text-egg-mute">{`${lectureLabel(v.day, v.time)}${lecture ? ` · ${lecture.title}` : ''}`}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
