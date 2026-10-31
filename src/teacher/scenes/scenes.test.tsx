import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { ProblemScene } from './ProblemScene';
import { HowItWorks } from './HowItWorks';
import { Closing } from './Closing';
import { TEACHER_QUESTIONS } from '../../scenario/sources';

describe('full-canvas scenes', () => {
  it('Problem shows the questions only from 8000', () => {
    expect(html(<ProblemScene t={7000} cursor={false} />)).not.toContain(TEACHER_QUESTIONS[0]);
    expect(html(<ProblemScene t={14000} cursor={false} />)).toContain(TEACHER_QUESTIONS[4]);
  });
  it('How it works names every layer and both apps', () => {
    const out = html(<HowItWorks t={19000} />);
    for (const s of ['Multimodal Foundation Models', 'Knowledge Graph', 'Learning Digital Twin', 'Agentic AI', 'Teacher app', 'Student app', 'SAS', 'TAS']) expect(out).toContain(s);
  });
  it('Closing shows the wordmark and tagline', () => {
    const out = html(<Closing t={4000} />);
    expect(out).toContain('Beyond');
    expect(out).toContain('Agentic Adaptation.');
  });
});
