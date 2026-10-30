import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ControllerApp } from './ControllerApp';
import { SCENES } from '../scenario/scenes';

describe('ControllerApp', () => {
  it('lists all 12 scenes with durations and the transport', () => {
    const s = renderToStaticMarkup(<ControllerApp />);
    for (const sc of SCENES) expect(s).toContain(sc.label.replace('&', '&amp;'));
    expect(s).toContain('00:12.0');
    expect(s).toContain('Play all');
    expect(s).toContain('Open dashboard window');
    expect(s).toContain('Total 03:30.0');
  });
});
