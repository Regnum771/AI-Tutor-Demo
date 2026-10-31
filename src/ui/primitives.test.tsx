import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { FakeCursor } from './FakeCursor';
import { ParticleStream } from './ParticleStream';

describe('ui primitives', () => {
  it('FakeCursor renders nothing when hidden', () => {
    expect(html(<FakeCursor t={0} keys={[{ t: 0, x: 0, y: 0 }]} visible={false} />)).toBe('');
  });
  it('ParticleStream has no particles before start and some during travel', () => {
    const props = { from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, start: 1000, count: 3 };
    expect(html(<svg><ParticleStream t={0} {...props} /></svg>)).not.toMatch(/<(rect|circle)/);
    expect(html(<svg><ParticleStream t={1500} {...props} /></svg>)).toMatch(/<(rect|circle)/);
  });
});
