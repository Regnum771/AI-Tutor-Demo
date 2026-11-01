import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { ForecastChart } from './ForecastChart';

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
