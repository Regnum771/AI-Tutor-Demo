import type { AgentId } from '../scenario/agents';
import { C } from './tokens';

export const agentColor = (a: AgentId): string => (a === 'SAS' ? C.sas : C.tas);
export const agentName = (a: AgentId): string => (a === 'SAS' ? 'Student Analysis Agent' : 'Teaching Assistance Agent');

/** Agent ring centred on (x, y) with its name and a live status line underneath. */
export function AgentNode({ agent, x, y, status, pulse = 0, size = 150 }: { agent: AgentId; x: number; y: number; status: string; pulse?: number; size?: number }) {
  const color = agentColor(agent);
  return (
    <div className="absolute flex flex-col items-center" style={{ left: x - 200, top: y - size / 2, width: 400 }}>
      <div
        className="flex items-center justify-center rounded-full font-display font-extrabold"
        style={{ width: size, height: size, border: `4px solid ${color}`, background: C.panel, color, fontSize: size * 0.27, boxShadow: `0 0 ${16 + 44 * pulse}px ${color}` }}
      >
        {agent}
      </div>
      <div className="mt-3 whitespace-nowrap font-display text-[22px] font-bold" style={{ color }}>{agentName(agent)}</div>
      <div className="mt-1 whitespace-nowrap font-mono text-[16px] text-dim">{status}</div>
    </div>
  );
}
