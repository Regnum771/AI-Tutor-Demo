import { describe, expect, it } from 'vitest';
import { CUES, SCENES, TOTAL_MS, sceneById } from './scenes';
import { CONCEPTS, EDGES, pathEdges, type ConceptId } from './knowledgeGraph';
import { DELTAS, MASTERY_INITIAL, MASTERY_MID, MASTERY_POST, MINH_ANH, gaps, lerpMastery } from './minhAnh';
import {
  SCALE_STUDENTS, STUDENTS, initials,
} from './classroom';

describe('scenes', () => {
  it('has 10 scenes totalling 2:30', () => {
    expect(SCENES.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(TOTAL_MS).toBe(150000);
  });
  it('shots are ascending and inside each scene', () => {
    for (const s of SCENES) {
      expect(s.shots.length).toBeGreaterThan(0);
      s.shots.forEach((t, i) => {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(s.durationMs);
        if (i) expect(t).toBeGreaterThan(s.shots[i - 1]);
      });
    }
  });
  it('cues lie inside Sc6 and Sc8', () => {
    expect(CUES.approveNotify).toBe(7500);
    expect(CUES.approveNotify).toBeLessThan(sceneById(6).durationMs);
    expect(CUES.adaptUpdate).toBe(9000);
    expect(CUES.adaptUpdate).toBeLessThan(sceneById(8).durationMs);
  });
  it('sceneById throws on unknown ids', () => {
    expect(() => sceneById(99)).toThrow();
  });
});

describe('knowledge graph', () => {
  it('has 12 unique concepts inside the 1100×560 viewBox', () => {
    expect(new Set(CONCEPTS.map((c) => c.id)).size).toBe(12);
    for (const c of CONCEPTS) {
      expect(c.x).toBeGreaterThan(30);
      expect(c.x).toBeLessThan(1070);
      expect(c.y + 58).toBeLessThan(560);
    }
  });
  it('edges reference known concepts and form a DAG', () => {
    const ids = new Set<ConceptId>(CONCEPTS.map((c) => c.id));
    for (const [a, b] of EDGES) {
      expect(ids.has(a)).toBe(true);
      expect(ids.has(b)).toBe(true);
    }
    const indeg = new Map<ConceptId, number>([...ids].map((id) => [id, 0]));
    for (const [, b] of EDGES) indeg.set(b, (indeg.get(b) ?? 0) + 1);
    const queue = [...ids].filter((id) => indeg.get(id) === 0);
    let visited = 0;
    while (queue.length) {
      const n = queue.shift()!;
      visited++;
      for (const [a, b] of EDGES) if (a === n) {
        indeg.set(b, indeg.get(b)! - 1);
        if (indeg.get(b) === 0) queue.push(b);
      }
    }
    expect(visited).toBe(ids.size);
  });
  it('pathEdges finds every edge from implication to equivalence', () => {
    const p = pathEdges('implication', 'equivalence').map(([a, b]) => `${a}>${b}`).sort();
    expect(p).toEqual([
      'biconditional>equivalence', 'implication>biconditional', 'implication>truthTables', 'truthTables>equivalence',
    ]);
  });
});

describe('Minh Anh', () => {
  it('matches the spec figures', () => {
    expect(MINH_ANH.scorePrev).toBe(75);
    expect(MINH_ANH.scoreNow).toBe(42);
    expect(MINH_ANH.scoreAfter).toBe(78);
    expect(MASTERY_INITIAL.conjunction).toBe(0.8);
    expect(MASTERY_INITIAL.disjunction).toBe(0.78);
    expect(MASTERY_INITIAL.negation).toBe(0.7);
    expect(MASTERY_INITIAL.implication).toBe(0.31);
    expect(MASTERY_INITIAL.biconditional).toBe(0.35);
    expect(MASTERY_INITIAL.equivalence).toBe(0.35);
    expect(MASTERY_POST.equivalence).toBe(0.78);
  });
  it('mastery only improves from initial → mid → post', () => {
    for (const c of CONCEPTS) {
      expect(MASTERY_MID[c.id]).toBeGreaterThanOrEqual(MASTERY_INITIAL[c.id]);
      expect(MASTERY_POST[c.id]).toBeGreaterThanOrEqual(MASTERY_MID[c.id]);
    }
  });
  it('deltas agree with the twin and scores', () => {
    const acc = DELTAS.find((d) => d.label === 'Exercise accuracy')!;
    expect(acc.before).toBe(`${MINH_ANH.scoreNow}%`);
    expect(acc.after).toBe(`${MINH_ANH.scoreAfter}%`);
    const eq = DELTAS.find((d) => d.label === 'Logical equivalence mastery')!;
    expect(eq.before).toBe(MASTERY_INITIAL.equivalence.toFixed(2));
    expect(eq.after).toBe(MASTERY_POST.equivalence.toFixed(2));
  });
  it('lerpMastery and gaps', () => {
    expect(lerpMastery(MASTERY_INITIAL, MASTERY_POST, 1).equivalence).toBeCloseTo(0.78);
    expect(gaps(MASTERY_INITIAL)).toEqual(['implication', 'biconditional', 'equivalence']);
  });
});

describe('classroom', () => {
  it('has 55 unique students with Minh Anh at s17', () => {
    expect(STUDENTS).toHaveLength(55);
    expect(new Set(STUDENTS.map((s) => s.name)).size).toBe(55);
    expect(STUDENTS[MINH_ANH.index].name).toBe(MINH_ANH.name);
    expect(STUDENTS[MINH_ANH.index].id).toBe('s17');
    expect(STUDENTS[MINH_ANH.index].status).toBe('highRisk');
    expect(STUDENTS[MINH_ANH.index].track).toBe('adaptive');
  });
  it('KPIs are 55 / 12 / 5', () => {
    const n = (st: string) => STUDENTS.filter((s) => s.status === st).length;
    expect({ total: STUDENTS.length, needSupport: n('support') + n('highRisk'), highRisk: n('highRisk') }).toEqual({ total: 55, needSupport: 12, highRisk: 5 });
  });
  it('portfolio is Routine 31 · Adaptive 9 · Complex 3', () => {
    const n = (t: string) => STUDENTS.filter((s) => s.track === t).length;
    expect({ routine: n('routine'), adaptive: n('adaptive'), complex: n('complex') }).toEqual({ routine: 31, adaptive: 9, complex: 3 });
  });
  it('scale students A–E map to fitting learners', () => {
    expect(SCALE_STUDENTS.map((s) => s.letter)).toEqual(['A', 'B', 'C', 'D', 'E']);
    const d = SCALE_STUDENTS.find((s) => s.letter === 'D')!;
    expect(STUDENTS[d.index].track).toBe('complex');
    const e = SCALE_STUDENTS.find((s) => s.letter === 'E')!;
    expect(STUDENTS[e.index].mastery).toBeGreaterThanOrEqual(0.85);
  });
  it('initials uses the last two name parts', () => {
    expect(initials('Nguyễn Minh Anh')).toBe('MA');
    expect(initials('Trần Bảo')).toBe('TB');
  });
});
