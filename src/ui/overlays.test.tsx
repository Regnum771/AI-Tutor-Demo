import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Overlays, FOOTER_LABEL } from './Overlays';
import { sceneById } from '../scenario/scenes';
import { DEFAULT_TOGGLES } from '../engine/playback';

const render = (t: number, over: Partial<typeof DEFAULT_TOGGLES> = {}, slate = false, variant: 'dashboard' | 'phone' = 'dashboard') =>
  renderToStaticMarkup(<Overlays scene={sceneById(3)} t={t} slate={slate} toggles={{ ...DEFAULT_TOGGLES, ...over }} variant={variant} />);

describe('Overlays', () => {
  it('shows the lower-third title shortly after scene start, then hides it', () => {
    expect(render(1500)).toContain('Learning Digital Twins');
    expect(render(0)).not.toContain('Learning Digital Twins');
    expect(render(14000)).not.toContain('Learning Digital Twins');
  });
  it('never shows titles on the phone or when toggled off', () => {
    expect(render(1500, {}, false, 'phone')).not.toContain('Learning Digital Twins');
    expect(render(1500, { titles: false })).not.toContain('Learning Digital Twins');
  });
  it('shows the footer label unless toggled off', () => {
    expect(render(0)).toContain(FOOTER_LABEL);
    expect(render(0, { footer: false })).not.toContain(FOOTER_LABEL);
  });
  it('burns in timecode when tc is on', () => {
    expect(render(6200, { tc: true })).toContain('Sc03 00:06.2');
  });
  it('renders the slate marker only when slate is true', () => {
    expect(render(0, {}, true)).toContain('data-slate');
    expect(render(0)).not.toContain('data-slate');
  });
});
