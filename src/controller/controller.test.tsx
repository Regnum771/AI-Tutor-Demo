import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BoothPanel, resolvePhoneUrl } from './BoothPanel';
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
  it('offers the Quiz 3 drop for a drastic signal on demand', () => {
    expect(renderToStaticMarkup(<BoothPanel />)).toContain('Simulate a Quiz 3 drop');
  });
  it('offers the live teacher, Reset demo and (once loaded) the phone QR code', () => {
    const out = renderToStaticMarkup(<BoothPanel />);
    expect(out).toContain('Live booth demo');
    expect(out).toContain('Open live teacher');
    expect(out).toContain('Reset demo');
  });
});

describe('resolvePhoneUrl', () => {
  it('turns the hosted link into the public address the Director is open on', () => {
    expect(resolvePhoneUrl('/student.html?live', 'https://beyond.example.app')).toBe('https://beyond.example.app/student.html?live');
  });
  it('leaves the local link on the laptop address, not localhost', () => {
    expect(resolvePhoneUrl('http://192.168.1.20:5173/student.html?live', 'http://localhost:5173')).toBe('http://192.168.1.20:5173/student.html?live');
  });
});
