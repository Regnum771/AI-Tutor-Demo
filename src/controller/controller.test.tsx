import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BoothPanel } from './BoothPanel';
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
    expect(s).toContain('Total 02:39.0');
  });
});


describe('BoothPanel', () => {
  it('offers the live teacher, Reset demo and (once loaded) the phone QR code', () => {
    const out = renderToStaticMarkup(<BoothPanel />);
    expect(out).toContain('Live booth demo');
    expect(out).toContain('Open live teacher');
    expect(out).toContain('Reset demo');
  });
});
