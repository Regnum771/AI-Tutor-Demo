import { cubic, easeInOut, type Point } from '../../engine/anim';
import type { AgentId } from '../../scenario/agents';
import type { ConceptId, Edge } from '../../scenario/knowledgeGraph';
import type { Mastery } from '../../scenario/minhAnh';
import { AgentNode, agentColor } from '../../ui/AgentNode';
import { Conduit } from '../../ui/Conduit';
import { FullSvg } from '../../ui/FullSvg';
import { GraphView } from '../../ui/GraphView';
import { TwinMini, type TwinKey } from '../../ui/TwinPanel';
import { C } from '../../ui/tokens';
import { TOKEN_MS } from './highlights';

export const SAS_POS = { x: 330, y: 270 };
export const TAS_POS = { x: 1590, y: 270 };
const UPPER: [Point, Point, Point, Point] = [{ x: 405, y: 250 }, { x: 700, y: 120 }, { x: 1220, y: 120 }, { x: 1515, y: 250 }];
const LOWER: [Point, Point, Point, Point] = [{ x: 1515, y: 300 }, { x: 1220, y: 430 }, { x: 700, y: 430 }, { x: 405, y: 300 }];
const pathD = ([a, b, c, d]: [Point, Point, Point, Point]) => `M${a.x} ${a.y} C${b.x} ${b.y}, ${c.x} ${c.y}, ${d.x} ${d.y}`;
const HUB_TWIN = { x: 750, y: 285 };
const HUB_GRAPH = { x: 740, y: 545, width: 440 };

export interface Token { at: number; from: AgentId; label: string }

export interface AgentStageProps {
  t: number;
  sasStatus: string;
  tasStatus: string;
  sasPulse?: number;
  tasPulse?: number;
  twinMastery: Mastery;
  twinHighlight?: TwinKey[];
  kgMastery?: Partial<Record<ConceptId, number>>;
  kgHighlight?: ConceptId[];
  kgEdges?: Edge[];
  tokens?: Token[];
  /** 0→1 strength of each agent's retrieval links into the hub. */
  retrieval?: { sas: number; tas: number };
}

/** SAS and TAS permanently linked through a shared hub (digital twin + knowledge graph). */
export function AgentStage({ t, sasStatus, tasStatus, sasPulse = 0, tasPulse = 0, twinMastery, twinHighlight = [], kgMastery = {}, kgHighlight = [], kgEdges = [], tokens = [], retrieval = { sas: 0.35, tas: 0.35 } }: AgentStageProps) {
  return (
    <>
      <FullSvg>
        <Conduit d={pathD(UPPER)} color={C.sas} t={t} width={4} />
        <Conduit d={pathD(LOWER)} color={C.tas} t={t} width={4} />
        <Conduit d="M405 300 C 560 330, 620 400, 750 400" color={C.sas} t={t} direction={-1} opacity={retrieval.sas} />
        <Conduit d="M405 330 C 540 500, 620 640, 740 650" color={C.sas} t={t} direction={-1} opacity={retrieval.sas} />
        <Conduit d="M1515 300 C 1360 330, 1300 400, 1170 400" color={C.tas} t={t} direction={-1} opacity={retrieval.tas} />
        <Conduit d="M1515 330 C 1380 500, 1300 640, 1180 650" color={C.tas} t={t} direction={-1} opacity={retrieval.tas} />
      </FullSvg>
      <div className="absolute" style={{ left: HUB_TWIN.x, top: HUB_TWIN.y }}>
        <TwinMini mastery={twinMastery} highlight={twinHighlight} />
      </div>
      <div className="absolute rounded-2xl border-2" style={{ left: HUB_GRAPH.x - 10, top: HUB_GRAPH.y - 10, width: HUB_GRAPH.width + 20, height: 244, borderColor: C.royal, background: C.panel }}>
        <div className="absolute" style={{ left: 10, top: 10 }}>
          <GraphView t={t} width={HUB_GRAPH.width} mastery={kgMastery} highlightNodes={kgHighlight} highlightEdges={kgEdges} showLabels={false} />
        </div>
      </div>
      <AgentNode agent="SAS" x={SAS_POS.x} y={SAS_POS.y} status={sasStatus} pulse={sasPulse} />
      <AgentNode agent="TAS" x={TAS_POS.x} y={TAS_POS.y} status={tasStatus} pulse={tasPulse} />
      {tokens.map((tk) => {
        const s = (t - tk.at) / TOKEN_MS;
        if (s < 0 || s > 1) return null;
        const p = cubic(...(tk.from === 'SAS' ? UPPER : LOWER), easeInOut(s));
        const color = agentColor(tk.from);
        return (
          <div key={`${tk.at}-${tk.label}`} className="absolute rounded-lg border-2 px-3 py-1 font-mono text-[16px] font-bold" style={{ left: p.x, top: p.y, transform: 'translate(-50%, -50%)', borderColor: color, color, background: C.panel, boxShadow: `0 0 18px ${color}`, zIndex: 30 }}>
            {tk.label}
          </div>
        );
      })}
    </>
  );
}
