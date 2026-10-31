import { easeInOut, fade, lerp, prog, pulse, stepIndex } from '../../engine/anim';
import { SAS_READS } from '../../scenario/agents';
import { conceptById, pathEdges } from '../../scenario/knowledgeGraph';
import { MASTERY_INITIAL, MASTERY_PRIOR, lerpMastery } from '../../scenario/minhAnh';
import { Conduit } from '../../ui/Conduit';
import { FullSvg } from '../../ui/FullSvg';
import { GraphView } from '../../ui/GraphView';
import { ParticleStream } from '../../ui/ParticleStream';
import { TwinPanel, type TwinKey } from '../../ui/TwinPanel';
import { C } from '../../ui/tokens';
import type { SceneProps } from './types';

const SHRINK_T = 7000;
const TWIN_IN_T = 7500;
const EVIDENCE_T = 10400;
const BRIDGE_T = 12600;
const READ_T = SAS_READS.map((_, i) => 9000 + i * 700);
const PATH = pathEdges('implication', 'equivalence');
const TITLE_H = 50;
const imp = conceptById('implication');

export function Sc04Represent({ t }: SceneProps) {
  const s = prog(t, SHRINK_T, 1500, easeInOut);
  const left = lerp(410, 40, s);
  const top = lerp(250, 300, s);
  const scale = lerp(1, 0.72, s);
  const node = { x: left + imp.x * scale, y: top + (TITLE_H + imp.y) * scale };
  const twinX = lerp(1920, 1000, prog(t, TWIN_IN_T, 1000));
  const readIdx = stepIndex(t, READ_T);
  const highlight: TwinKey[] = readIdx >= 0 && t < 13300 ? [SAS_READS[readIdx]] : [];
  if (t >= EVIDENCE_T && t < EVIDENCE_T + 1500) highlight.push('mastery.implication');
  const mastery = lerpMastery(MASTERY_PRIOR, MASTERY_INITIAL, prog(t, EVIDENCE_T, 800));
  return (
    <div className="absolute inset-0 bg-deep">
      <div className="absolute" style={{ left, top, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        <div className="font-display text-[26px] font-extrabold" style={{ color: C.royal, height: TITLE_H }}>Discrete Mathematics · Knowledge Graph</div>
        <GraphView
          t={t}
          appear={prog(t, 0, 1500)}
          mastery={MASTERY_INITIAL}
          masteryOpacity={prog(t, 1800, 800)}
          highlightNodes={t >= 3600 ? ['implication'] : []}
          highlightEdges={t >= 4200 ? PATH : []}
        />
        <div className="absolute rounded-lg border-2 px-3 py-1 text-[20px] font-semibold text-ink" style={{ left: imp.x + 50, top: TITLE_H + imp.y + 60, borderColor: C.gap, background: C.panel, opacity: fade(t, 4800, SHRINK_T + 300) }}>
          Prerequisite gap → Implication
        </div>
      </div>

      {[
        { text: 'Quiz 2 · Q4 chose q → p (×6)', y: 600 },
        { text: 'Zalo · "chưa hiểu vì sao p → q khác q → p"', y: 690 },
      ].map((chip, i) => (
        <div key={chip.text} className="absolute rounded-lg border-2 px-3 py-2 font-sans text-[18px] text-ink" style={{ left: 40, top: chip.y, width: 340, borderColor: C.cyan, background: C.panel, opacity: fade(t, 3000 + i * 300, SHRINK_T) }}>
          {chip.text}
        </div>
      ))}

      <FullSvg>
        <Conduit d={`M380 650 C 520 650, 560 ${node.y}, ${node.x - 32} ${node.y}`} color={C.cyan} t={t} opacity={fade(t, 3600, SHRINK_T)} />
        <ParticleStream t={t} from={{ x: 760, y: 640 }} to={{ x: 1000, y: 520 }} start={9600} count={8} gap={150} travel={800} />
        <Conduit d={`M${node.x + 30} ${node.y} C 600 ${node.y}, 760 560, 1000 560`} color={C.royal} t={t} width={4} opacity={fade(t, BRIDGE_T)} />
      </FullSvg>
      <div className="absolute font-display text-[18px] font-bold leading-tight" style={{ left: 856, top: 574, width: 140, color: C.royal, opacity: fade(t, BRIDGE_T + 300) }}>Grounded representation</div>

      <div className="absolute" style={{ left: twinX, top: 110 }}>
        <TwinPanel
          mastery={mastery}
          stateLabel={t < EVIDENCE_T ? 'Synced · Week 5' : 'Updated · new evidence'}
          highlight={highlight}
          glow={pulse(t, [EVIDENCE_T], 1200)}
        />
      </div>
    </div>
  );
}
