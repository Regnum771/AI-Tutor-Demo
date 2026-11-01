// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { classAverage } from '../live/history';
import { seedState } from '../live/seed';
import type { ConceptId } from '../scenario/knowledgeGraph';
import { EDGES } from '../scenario/knowledgeGraph';
import { ConceptGraph } from './ConceptGraph';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const graph = (s = seedState(), selected: ConceptId | null = null) => {
  host = document.createElement('div');
  host.innerHTML = html(<ConceptGraph state={s} selected={selected} onSelect={() => {}} />);
  return host;
};
const node = (el: HTMLElement, id: string) => el.querySelector(`[data-node="${id}"]`)!;

describe('knowledge graph', () => {
  it('draws the 12 concepts and every prerequisite edge', () => {
    const el = graph();
    expect(el.querySelectorAll('[data-node]')).toHaveLength(12);
    expect(el.querySelectorAll('[data-edge]')).toHaveLength(EDGES.length);
    expect(el.querySelector('[data-edge="equivalence-equivLaws"]')).not.toBeNull();
  });
  it('shows the class average under each lectured concept, and greys the rest with their lecture and date', () => {
    const s = seedState();
    const el = graph(s);
    expect(node(el, 'equivalence').textContent).toBe(`Logical equivalence${classAverage(s.students, 'equivalence').toFixed(2)}`);
    expect(node(el, 'equivalence').hasAttribute('data-untaught')).toBe(false);
    expect([...el.querySelectorAll('[data-untaught]')].map((n) => n.getAttribute('data-node'))).toEqual(['equivLaws', 'applications']);
    expect(node(el, 'equivLaws').textContent).toBe('Equivalence lawsLecture 7 · Tue 3 Nov');
    expect(node(el, 'applications').textContent).toBe('ApplicationsLecture 8 · Tue 10 Nov');
  });
  it('marks a concept below 0.50 as a gap, the way the heatmap does', () => {
    const s = seedState();
    expect(graph(s).querySelectorAll('[data-gap]')).toHaveLength(0);
    for (const st of s.students) st.mastery.implication = 0.3;
    const el = graph(s);
    expect([...el.querySelectorAll('[data-gap]')].map((n) => n.getAttribute('data-node'))).toEqual(['implication']);
    expect(node(el, 'implication').querySelector('.font-bold')?.textContent).toBe('0.30');
  });
  it('selects a node on click and clears it on a second click', async () => {
    const picks: (ConceptId | null)[] = [];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const draw = (selected: ConceptId | null) => root!.render(<ConceptGraph state={seedState()} selected={selected} onSelect={(c) => { picks.push(c); }} />);
    await act(async () => draw(null));
    await act(async () => (node(host!, 'implication') as HTMLElement).click());
    await act(async () => draw('implication'));
    expect(node(host, 'implication').getAttribute('aria-pressed')).toBe('true');
    await act(async () => (node(host!, 'implication') as HTMLElement).click());
    expect(picks).toEqual(['implication', null]);
  });
});
