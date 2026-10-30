import { describe, expect, it } from 'vitest';
import { EVIDENCE_ITEMS, MESSAGES, SOURCE_WINDOWS, TEACHER_QUESTIONS } from './sources';
import { EXCHANGES, REASSESSMENT, refTarget } from './agents';
import { ACTIVITIES, OPERATIONS, PATHWAY_INITIAL, RETRIEVED, STATUSES } from './orchestration';
import { RESOURCES } from './agents';
import { PATHWAY_A, PATHWAY_B, sessionsToTarget } from './simulation';
import { GUIDED, HINT_ROW, PROGRESS, Q1, SC9, SC9_EVIDENCE, equivalent } from './practice';
import { MASTERY_INITIAL, MASTERY_MID } from './minhAnh';
import { sceneById } from './scenes';

describe('sources', () => {
  it('has 8 distinct windows inside the canvas', () => {
    expect(new Set(SOURCE_WINDOWS.map((w) => w.kind)).size).toBe(8);
    for (const w of SOURCE_WINDOWS) {
      expect(w.x + w.w).toBeLessThanOrEqual(1920);
      expect(w.y + w.h).toBeLessThanOrEqual(1080);
    }
  });
  it('messages cover Zalo, WhatsApp and email in Vietnamese with English evidence', () => {
    expect(new Set(MESSAGES.map((m) => m.channel))).toEqual(new Set(['zalo', 'whatsapp', 'email']));
    for (const m of MESSAGES) {
      expect(m.vi).toMatch(/[^\x00-\x7F]/);
      expect(m.evidence.length).toBeGreaterThan(5);
    }
  });
  it('has 5 teacher questions and 5 evidence items', () => {
    expect(TEACHER_QUESTIONS).toHaveLength(5);
    expect(EVIDENCE_ITEMS).toHaveLength(5);
  });
});

describe('agents', () => {
  it('exchanges alternate SAS→TAS→SAS→TAS with the spec card types', () => {
    expect(EXCHANGES.map((c) => `${c.from}>${c.to}:${c.type}`)).toEqual([
      'SAS>TAS:DIAGNOSIS', 'TAS>SAS:PROPOSAL', 'SAS>TAS:CHALLENGE', 'TAS>SAS:REFINEMENT',
    ]);
  });
  it('every evidence ref resolves to a real twin field, KG node, objective or resource', () => {
    for (const card of [...EXCHANGES, ...REASSESSMENT]) {
      for (const r of card.refs) expect(refTarget(r), r).not.toBeNull();
    }
  });
  it('refTarget rejects unknown refs', () => {
    expect(refTarget('kg:nope')).toBeNull();
    expect(refTarget('twin.mastery.nope')).toBeNull();
    expect(refTarget('resources.nope')).toBeNull();
  });
});

describe('orchestration', () => {
  it('has one status per operation and consistent content', () => {
    expect(OPERATIONS).toHaveLength(6);
    expect(STATUSES).toHaveLength(6);
    expect(ACTIVITIES).toHaveLength(5);
    expect(PATHWAY_INITIAL).toHaveLength(4);
    for (const r of RETRIEVED) expect(RESOURCES[r]).toBeTruthy();
  });
});

describe('simulation', () => {
  it('B reaches 0.75 in 3 sessions, A in 6', () => {
    expect(sessionsToTarget(PATHWAY_A.curve)).toBe(6);
    expect(sessionsToTarget(PATHWAY_B.curve)).toBe(3);
    expect(PATHWAY_A.curve[0]).toBe(MASTERY_INITIAL.equivalence);
    expect(PATHWAY_B.curve[0]).toBe(MASTERY_INITIAL.equivalence);
  });
});

describe('practice', () => {
  it('exactly one option is equivalent to p → q', () => {
    const eq = Q1.options.filter((o) => equivalent(o.f, (p, q) => !p || q));
    expect(eq).toHaveLength(1);
    expect(Q1.options[Q1.correct].label).toBe('¬p ∨ q');
  });
  it('the chosen wrong answer is the converse and the hint row separates it', () => {
    const wrong = Q1.options[Q1.chosenWrong];
    expect(wrong.label).toBe('q → p');
    expect(wrong.f(HINT_ROW.p, HINT_ROW.q)).not.toBe(!HINT_ROW.p || HINT_ROW.q);
  });
  it('every guided step is equivalent to ¬(p → q)', () => {
    for (const s of GUIDED.steps) expect(equivalent(s.f, GUIDED.start), s.expr).toBe(true);
    expect(GUIDED.steps.at(-1)!.expr).toBe('p ∧ ¬q');
  });
  it('Sc9 timeline is ascending and inside the scene', () => {
    const order = [SC9.tap, SC9.plan, SC9.practice, SC9.pickWrong, SC9.hint, SC9.pickRight, SC9.guided, ...SC9.guidedSteps, SC9.progress];
    order.forEach((t, i) => i && expect(t).toBeGreaterThan(order[i - 1]));
    expect(SC9.progress).toBeLessThan(sceneById(9).durationMs);
    SC9_EVIDENCE.forEach((e, i) => i && expect(e.at).toBeGreaterThan(SC9_EVIDENCE[i - 1].at));
  });
  it('phone progress matches the twin', () => {
    expect(PROGRESS.from).toBe(Math.round(MASTERY_INITIAL.implication * 100));
    expect(PROGRESS.to).toBe(Math.round(MASTERY_MID.implication * 100));
  });
});
