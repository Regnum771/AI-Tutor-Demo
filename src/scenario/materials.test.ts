import { describe, expect, it } from 'vitest';
import { STUDENTS } from './classroom';
import { LECTURES } from './course';
import { CONCEPTS } from './knowledgeGraph';
import { classEngagement, engagement, isReleased, notOpened, RESOURCE_BLOOMS, RESOURCES, resourceById, resourceChip, resourcesFor } from './materials';

describe('the resource library', () => {
  it('points every resource at a real lecture and its concepts, with a valid Bloom level and a unique id', () => {
    expect(RESOURCES).toHaveLength(29);
    expect(new Set(RESOURCES.map((r) => r.id)).size).toBe(RESOURCES.length);
    for (const r of RESOURCES) {
      const l = LECTURES.find((x) => x.n === r.lecture);
      expect(l, r.id).toBeDefined();
      const allowed = l!.concepts.length ? l!.concepts : CONCEPTS.map((c) => c.id);
      expect(r.concepts.length, r.id).toBeGreaterThan(0);
      for (const c of r.concepts) expect(allowed, r.id).toContain(c);
      expect(RESOURCE_BLOOMS).toContain(r.bloom);
      expect(r.minutes).toBeGreaterThan(0);
      expect(`${r.title} ${r.source}`).not.toMatch(/https?:|www\.|\.com\b/);
    }
    for (const l of LECTURES) expect(resourcesFor(l.n).length, `Lecture ${l.n}`).toBeGreaterThan(0);
  });
  it('has slides, a recording and a worksheet for Lectures 1–8, an extra for 3, 5, 6 and 7, and a revision sheet for 9', () => {
    for (let n = 1; n <= 8; n++) expect(resourcesFor(n).slice(0, 3).map((r) => r.kind)).toEqual(['slides', 'recording', 'worksheet']);
    expect([3, 5, 6, 7].map((n) => resourcesFor(n).length)).toEqual([4, 4, 4, 4]);
    expect([1, 2, 4, 8].map((n) => resourcesFor(n).length)).toEqual([3, 3, 3, 3]);
    expect(resourcesFor(9).map((r) => r.id)).toEqual(['l9-revision']);
  });
  it('keeps the titles from the video’s Learning Materials window', () => {
    expect(resourceById('l5-slides')?.title).toBe('Lecture 5 · Implication.pdf');
    expect(resourceById('l3-worksheet')?.title).toBe('Worksheet · Truth tables');
    expect(resourceById('l5-recording')?.title).toBe('Lecture 5 recording');
    expect(resourceById('l5-reading')?.source).toBe('Rosen §1.1');
    expect(resourceChip(resourceById('l7-slides')!)).toBe('Slides · Lecture 7');
  });
  it('follows the material with its Bloom level', () => {
    for (const r of RESOURCES) {
      if (r.kind === 'slides' || r.kind === 'recording') expect(['Remember', 'Understand']).toContain(r.bloom);
      if (r.kind === 'worksheet') expect(r.bloom).toBe('Apply');
      if (r.kind === 'reading') expect(['Understand', 'Analyze']).toContain(r.bloom);
    }
  });
});

describe('engagement', () => {
  it('is deterministic and stays in range', () => {
    for (const r of RESOURCES) {
      for (const s of STUDENTS) {
        const e = engagement(r.id, s.index);
        expect(engagement(r.id, s.index)).toEqual(e);
        expect(e.fraction).toBeGreaterThanOrEqual(0);
        expect(e.fraction).toBeLessThanOrEqual(1);
        if (!e.opened) expect(e.fraction).toBe(0);
      }
    }
  });
  it('Minh Anh opened the Lecture 5 recording and watched 22% of it', () => {
    expect(engagement('l5-recording', 16)).toEqual({ opened: true, fraction: 0.22 });
    expect(resourcesFor(6).some((r) => engagement(r.id, 16).opened)).toBe(false);
  });
  it('the quiet disengager (index 7) opened nothing after Week 4', () => {
    for (const r of RESOURCES.filter((x) => x.lecture >= 5)) expect(engagement(r.id, 7).opened, r.id).toBe(false);
    expect(RESOURCES.filter((x) => x.lecture <= 4).some((r) => engagement(r.id, 7).opened)).toBe(true);
  });
  it('on-track students open more than high-risk students', () => {
    const rate = (status: string) => {
      const group = STUDENTS.filter((s) => s.status === status);
      const opened = RESOURCES.filter((r) => r.lecture <= 6).reduce((a, r) => a + group.filter((s) => engagement(r.id, s.index).opened).length, 0);
      return opened / group.length;
    };
    expect(rate('onTrack')).toBeGreaterThan(rate('support'));
    expect(rate('support')).toBeGreaterThan(rate('highRisk'));
  });
  it('has nothing for lectures after today, and fills in as the story moves on', () => {
    for (const r of RESOURCES.filter((x) => x.lecture >= 7)) {
      expect(classEngagement(r.id)).toEqual({ opened: 0, of: 55, meanFraction: 0 });
      expect(notOpened(r.id)).toHaveLength(55);
    }
    expect(classEngagement('l7-slides', 50).opened).toBeGreaterThan(0);
    expect(isReleased(resourceById('l7-slides')!, 40, '15:00')).toBe(false);
    expect(isReleased(resourceById('l7-slides')!, 43, '09:00')).toBe(true);
    expect(isReleased(resourceById('l6-slides')!, 40, '15:00')).toBe(true);
  });
  it('reports the class figure the tab shows', () => {
    expect(classEngagement('l5-recording')).toEqual({ opened: 31, of: 55, meanFraction: 0.46 });
    expect(notOpened('l5-recording')).toHaveLength(24);
    expect(notOpened('l5-recording')).not.toContain(16);
    expect(notOpened('l5-recording')).toContain(7);
  });
});
