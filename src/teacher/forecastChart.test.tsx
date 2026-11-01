import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { ctxFor } from '../live/fixtures';
import { LiveProvider } from '../live/LiveContext';
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import { ForecastChart } from './ForecastChart';
import { StudentProfile } from './StudentProfile';

describe('forecast chart', () => {
  const points = [{ day: 17, value: 6.1 }, { day: 38, value: 4.4 }, { day: 40, value: 4.4 }];
  it('draws the history, the grade lines and the markers', () => {
    const out = html(<ForecastChart points={points} projection={null} markers={[{ day: 52, label: 'Quiz 3', row: 'assessment' }]} />);
    expect(out).toContain('Pass 4.0');
    expect(out).toContain('Khá 7.0');
    expect(out).toContain('Giỏi 8.5');
    expect(out).toContain('Quiz 3');
    expect(out).toContain('data-series="forecast"');
    expect(out).not.toContain('data-series="projection"');
  });
  it('puts intervention labels on their own row, apart from the assessments', () => {
    const out = html(<ForecastChart points={points} projection={null} markers={[{ day: 38, label: 'Quiz 2', row: 'assessment' }, { day: 40, label: 'Pathway', row: 'intervention' }, { day: 40, label: 'Check-in', row: 'intervention' }]} />);
    expect(out).toMatch(/data-marker-row="assessment"[^>]*>Quiz 2</);
    expect(out).toMatch(/data-marker-row="intervention"[^>]*>Pathway</);
    expect(out).toMatch(/data-marker-row="intervention"[^>]*>Check-in</);
  });
  it('dashes the projection from the last point to the exam', () => {
    const out = html(<ForecastChart points={points} projection={{ day: 64, value: 6.4 }} markers={[]} />);
    expect(out).toContain('data-series="projection"');
    expect(out).toContain('6.4 if the plan is kept');
  });
});

describe('the profile chart', () => {
  const profile = (idle: number[], replan = false) => {
    const s = seedState();
    const rec = ensureRecord(s, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    for (const d of idle) rec.days[d] = { planned: 30, done: 0, check: null };
    if (replan) rec.replans.push({ day: 43, signal: 'disengaged', reason: 'Lighter.' });
    return html(
      <LiveProvider value={ctxFor(s, null)}>
        <StudentProfile studentId="s17" entryId={null} onClose={() => {}} onAsk={() => {}} onOpenChat={() => {}} />
      </LiveProvider>,
    );
  };
  const stoppedX = (out: string) => out.match(/data-marker-row="intervention"[^>]* x="([\d.]+)"[^>]*>Stopped</)?.[1] ?? out.match(/x="([\d.]+)"[^>]*data-marker-row="intervention"[^>]*>Stopped</)?.[1];
  it('puts one Stopped marker on the intervention row, on the day the current stretch began', () => {
    const out = profile([37, 38, 39]);
    expect(out).toMatch(/data-marker-row="intervention"[^>]*>Stopped</);
    expect(out.match(/>Stopped</g)).toHaveLength(1);
    const earlier = profile([36, 37, 38, 39]);
    expect(stoppedX(out)).toBeDefined();
    expect(stoppedX(earlier)).toBeDefined();
    expect(Number(stoppedX(earlier))).toBeLessThan(Number(stoppedX(out)));
  });
  it('has no Stopped marker while the student is practising, replan or not', () => {
    expect(profile([], true)).not.toContain('>Stopped<');
  });
});
