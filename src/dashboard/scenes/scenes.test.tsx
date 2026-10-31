import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SCENE_VIEWS } from './index';
import { SCENES, sceneById } from '../../scenario/scenes';

const render = (id: number, t: number) => {
  const View = SCENE_VIEWS[id];
  if (!View) throw new Error(`Scene ${id} not registered`);
  return renderToStaticMarkup(<View t={t} cursor />);
};

describe('registered scenes render at every shot', () => {
  it('no registered scene throws at its shots, t=0 or the end', () => {
    for (const s of SCENES) {
      if (!SCENE_VIEWS[s.id]) continue;
      for (const t of [0, ...s.shots, s.durationMs]) expect(() => render(s.id, t)).not.toThrow();
    }
  });
});

describe('Sc1 Fragmented', () => {
  it('shows the source windows and the teacher questions', () => {
    const s = render(1, 11000);
    expect(s).toContain('Zalo');
    expect(s).toContain('WhatsApp');
    expect(s).toContain('Inbox');
    expect(s).toContain('Which students are falling behind?');
    expect(s).toContain('What intervention should happen next, and when?');
  });
});

describe('Sc2 Architecture / Sc12 Closing', () => {
  it('reveals the pillars and logo', () => {
    const s = render(2, 9500);
    expect(s).toContain('Multimodal Foundation Models');
    expect(s).toContain('Knowledge Graph');
    expect(s).toContain('Learning Digital Twin');
    expect(s).toContain('BEYOND AI TUTORING');
    expect(render(2, 1000)).not.toContain('BEYOND AI TUTORING');
  });
  it('closing adds the operational components and the full tagline', () => {
    const s = render(12, sceneById(12).durationMs);
    expect(s).toContain('Intervention Orchestration Engine');
    expect(s).toContain('Teacher Command Center');
    expect(s).toContain('Student Application');
    expect(s).toContain('Dynamic Digital Twins');
  });
});
