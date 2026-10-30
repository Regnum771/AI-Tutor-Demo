import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { Kpi } from './Kpi';
import { MessageCard } from './MessageCard';
import { AgentNode } from './AgentNode';
import { GraphView } from './GraphView';
import { TwinPanel, TwinMini } from './TwinPanel';
import { StudentGrid, tileCenter } from './StudentGrid';
import { PipelineStatus } from './PipelineStatus';
import { FakeCursor } from './FakeCursor';
import { ParticleStream } from './ParticleStream';
import { Camera } from './Camera';
import { EXCHANGES } from '../scenario/agents';
import { CONCEPTS } from '../scenario/knowledgeGraph';
import { MASTERY_INITIAL } from '../scenario/minhAnh';
import { STATUSES } from '../scenario/orchestration';

describe('ui primitives', () => {
  it('Kpi shows value and label', () => {
    const s = html(<Kpi label="Students" value={55} />);
    expect(s).toContain('55');
    expect(s).toContain('Students');
  });
  it('MessageCard shows type, route and refs', () => {
    const s = html(<MessageCard card={EXCHANGES[0]} />);
    expect(s).toContain('DIAGNOSIS');
    expect(s).toContain('kg:implication');
    expect(s).toContain('SAS');
  });
  it('AgentNode names the agent', () => {
    expect(html(<AgentNode agent="TAS" x={0} y={0} status="idle" />)).toContain('Teaching Assistance Agent');
  });
  it('GraphView renders every concept label', () => {
    const s = html(<GraphView t={0} mastery={MASTERY_INITIAL} />);
    for (const c of CONCEPTS) expect(s).toContain(c.label.replace("'", '&#x27;'));
  });
  it('TwinPanel and TwinMini show Minh Anh and mastery values', () => {
    const s = html(<TwinPanel mastery={MASTERY_INITIAL} stateLabel="Synced" />);
    expect(s).toContain('Learning Digital Twin');
    expect(s).toContain('Nguyễn Minh Anh');
    expect(s).toContain('0.31');
    expect(html(<TwinMini mastery={MASTERY_INITIAL} />)).toContain('0.80');
  });
  it('StudentGrid renders 55 tiles including MA', () => {
    const s = html(<StudentGrid t={0} />);
    expect(s.match(/data-tile/g)).toHaveLength(55);
    expect(s).toContain('MA');
    expect(tileCenter(16)).toEqual({ x: 586, y: 488 });
  });
  it('PipelineStatus renders all statuses', () => {
    const s = html(<PipelineStatus statuses={STATUSES} reached={2} />);
    for (const st of STATUSES) expect(s).toContain(st);
  });
  it('FakeCursor renders nothing when hidden', () => {
    expect(html(<FakeCursor t={0} keys={[{ t: 0, x: 0, y: 0 }]} visible={false} />)).toBe('');
  });
  it('ParticleStream has no particles before start and some during travel', () => {
    const props = { from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, start: 1000, count: 3 };
    expect(html(<svg><ParticleStream t={0} {...props} /></svg>)).not.toMatch(/<(rect|circle)/);
    expect(html(<svg><ParticleStream t={1500} {...props} /></svg>)).toMatch(/<(rect|circle)/);
  });
  it('Camera at identity keeps content untransformed', () => {
    expect(html(<Camera t={0} keys={[{ t: 0, x: 960, y: 540, zoom: 1 }]}><i /></Camera>)).toContain('translate(0px, 0px) scale(1)');
  });
});
