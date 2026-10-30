import type { CSSProperties } from 'react';
import { refTarget, type AgentCard } from '../scenario/agents';
import { agentColor } from './AgentNode';
import { C } from './tokens';

const refColor = (ref: string): string => {
  const kind = refTarget(ref)?.kind;
  return kind === 'kg' ? C.royal : kind === 'twin' ? C.twin : C.dim;
};

/** Structured agent-to-agent message: type badge, route, statement and evidence refs. */
export function MessageCard({ card, style }: { card: AgentCard; style?: CSSProperties }) {
  const from = agentColor(card.from);
  return (
    <div style={{ width: 480, borderRadius: 16, padding: 18, background: C.panel, border: `2px solid ${from}`, ...style }}>
      <div className="flex items-center justify-between font-mono text-[16px]">
        <span className="font-bold" style={{ color: from }}>{card.type}</span>
        <span className="text-dim">
          <span style={{ color: from }}>{card.from}</span> → <span style={{ color: agentColor(card.to) }}>{card.to}</span>
        </span>
      </div>
      <div className="mt-2 text-[19px] leading-snug text-ink">{card.text}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {card.refs.map((r) => (
          <span key={r} className="rounded-md px-2 py-0.5 font-mono text-[14px]" style={{ background: C.surface, color: refColor(r) }}>{r}</span>
        ))}
      </div>
    </div>
  );
}
