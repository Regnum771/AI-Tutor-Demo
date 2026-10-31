import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ControllerApp } from './ControllerApp';
import { SCENES } from '../scenario/scenes';

describe('ControllerApp', () => {
  it('lists all 10 scenes with durations and the transport', () => {
    const s = renderToStaticMarkup(<ControllerApp />);
    for (const sc of SCENES) expect(s).toContain(sc.label.replace('&', '&amp;'));
    expect(s).toContain('00:15.0');
    expect(s).toContain('Play all');
    expect(s).toContain('Open teacher window');
    expect(s).toContain('Chapter label');
    expect(s).toContain('Classroom');
    expect(s).toContain('How it works');
    expect(s).toContain('Total 02:30.0');
  });
});
