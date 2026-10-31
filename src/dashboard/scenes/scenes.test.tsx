import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SCENE_VIEWS } from './index';
import { CUES, SCENES, sceneById } from '../../scenario/scenes';

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

describe('Sc3 Perceive', () => {
  it('shows KPIs, extracted evidence and Minh Anh profile', () => {
    const s = render(3, 14000);
    expect(s).toContain('Classroom Command Center');
    expect(s).toContain('Need support');
    expect(s).toContain('Confused why p → q ≠ q → p');
    expect(s).toContain('Nguyễn Minh Anh');
    expect(s).toContain('75% → 42%');
  });
});

describe('Sc8 Govern', () => {
  it('shows the portfolio and the edited escalation rule', () => {
    const before = render(8, 3000);
    expect(before).toContain('Routine');
    expect(before).toContain('31');
    expect(before).toContain('3 sessions');
    const after = render(8, 6000);
    expect(after).toContain('2 sessions');
    expect(after).toContain('Policy updated');
  });
  it('opens Minh Anh intervention summary', () => {
    const s = render(8, 13500);
    expect(s).toContain('Intervention summary');
    expect(s).toContain('MONITORING');
    expect(s).toContain('Logical equivalence mastery ≥ 0.70');
  });
});

describe('Sc11 Scale', () => {
  it('shows parallel interventions and outcomes', () => {
    const s = render(11, 13500);
    expect(s).toContain('Visual scaffolding');
    expect(s).toContain('Teacher-supported intervention');
    expect(s).toContain('Improved learning');
    expect(s).toContain('Guided conceptual practice');
  });
});

describe('Sc4 Represent', () => {
  it('shows the knowledge graph, then the twin with updated evidence', () => {
    const early = render(4, 5500);
    expect(early).toContain('Knowledge Graph');
    expect(early).toContain('Prerequisite gap → Implication');
    const late = render(4, 13500);
    expect(late).toContain('Learning Digital Twin');
    expect(late).toContain('Updated · new evidence');
    expect(late).toContain('Grounded representation');
  });
});

describe('Sc9 Experience (dashboard companion)', () => {
  it('streams evidence from the student device into the twin', () => {
    const s = render(9, 17000);
    expect(s).toContain('Live evidence · Minh Anh&#x27;s device');
    expect(s).toContain('Answer ¬p ∨ q · correct');
    expect(s).toContain('0.52');
  });
});

describe('Sc5 Reason', () => {
  it('shows both agents, SAS diagnosis and TAS analysis', () => {
    const s = render(5, 14000);
    expect(s).toContain('Student Analysis Agent');
    expect(s).toContain('Teaching Assistance Agent');
    expect(s).toContain('SAS · Student Diagnosis');
    expect(s).toContain('Incomplete understanding of logical operators');
    expect(s).toContain('TAS · Instructional Analysis');
    expect(s).toContain('Mastery assessment');
  });
});

describe('Sc6 Collaborate', () => {
  it('delivers the challenge to TAS and narrows the plan', () => {
    const s = render(6, 13500);
    expect(s).toContain('CHALLENGE');
    expect(s).toContain('line-through');
  });
  it('ends with the co-signed joint decision', () => {
    const s = render(6, 22000);
    expect(s).toContain('Joint decision');
    expect(s).toContain('Targeted Prerequisite Reinforcement');
    expect(s).toContain('SAS ✓');
    expect(s).toContain('TAS ✓');
  });
});

describe('Sc7 Orchestrate', () => {
  it('runs the six operations and reaches DELIVERED at the cue', () => {
    const mid = render(7, 10500);
    expect(mid).toContain('Intervention Orchestration Engine');
    expect(mid).toContain('Activity generation &amp; assembly');
    expect(mid).toContain('Worked examples');
    const end = render(7, 24000);
    expect(end).toContain('MONITORING');
    expect(end).toContain('Mastery check score');
    expect(end).toContain('Delivered to Minh Anh&#x27;s student app');
  });
  it('shows delivery only once the shared cue is reached', () => {
    expect(render(7, CUES.sc7Delivered - 200)).not.toContain('Delivered to Minh Anh&#x27;s student app');
    expect(render(7, CUES.sc7Delivered + 200)).toContain('Delivered to Minh Anh&#x27;s student app');
  });
});
