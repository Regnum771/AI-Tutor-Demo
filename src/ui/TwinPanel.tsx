import type { ReactNode } from 'react';
import { conceptById, type ConceptId } from '../scenario/knowledgeGraph';
import { MINH_ANH, TWIN_ACTIVITY, TWIN_FOCUS, TWIN_HISTORY, TWIN_PAST_INTERVENTIONS, gaps, type Mastery } from '../scenario/minhAnh';
import type { SAS_READS } from '../scenario/agents';
import { C, masteryColor } from './tokens';

export type TwinKey = (typeof SAS_READS)[number] | 'gaps' | `mastery.${ConceptId}`;

const HI_BG = 'rgba(167,139,250,0.14)';

function Block({ title, active, children }: { title: string; active: boolean; children: ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ border: `2px solid ${active ? C.twin : 'transparent'}`, background: active ? HI_BG : 'transparent' }}>
      <div className="mb-2 text-[15px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.twin }}>{title}</div>
      {children}
    </div>
  );
}

export function MasteryBar({ id, value, active }: { id: ConceptId; value: number; active: boolean }) {
  const c = conceptById(id);
  return (
    <div className="flex items-center gap-3 rounded-lg px-1 py-1" style={{ background: active ? HI_BG : 'transparent', outline: active ? `2px solid ${C.twin}` : 'none' }}>
      <span className="w-8 text-center font-mono text-[20px] text-ink">{c.symbol}</span>
      <span className="w-40 text-[17px] text-dim">{c.label}</span>
      <div className="h-3 flex-1 rounded-full" style={{ background: C.surface }}>
        <div className="h-full rounded-full" style={{ width: `${value * 100}%`, background: masteryColor(value) }} />
      </div>
      <span className="w-12 text-right font-mono text-[17px] text-ink">{value.toFixed(2)}</span>
    </div>
  );
}

export interface TwinPanelProps {
  mastery: Mastery;
  stateLabel: string;
  highlight?: TwinKey[];
  /** 0→1 evidence-update glow. */
  glow?: number;
  width?: number;
  assessment?: string;
}

export function TwinPanel({ mastery, stateLabel, highlight = [], glow = 0, width = 880, assessment = 'Quiz 2 · 42% (prev. 75%) · implication errors ×6' }: TwinPanelProps) {
  const on = (k: TwinKey) => highlight.includes(k);
  const open = gaps(mastery);
  return (
    <div className="rounded-2xl p-5" style={{ width, background: C.panel, border: `2px solid ${C.twin}`, boxShadow: `0 0 ${12 + glow * 48}px rgba(167,139,250,${0.25 + glow * 0.5})` }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-[26px] font-extrabold" style={{ color: C.twin }}>Learning Digital Twin</div>
          <div className="text-[20px] text-ink">{MINH_ANH.name} · {MINH_ANH.course}</div>
        </div>
        <span className="rounded-full px-3 py-1 font-mono text-[15px]" style={{ background: HI_BG, color: C.twin }}>{stateLabel}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <Block title="Topic-level mastery" active={on('mastery')}>
            {TWIN_FOCUS.map((id) => <MasteryBar key={id} id={id} value={mastery[id]} active={on(`mastery.${id}`)} />)}
          </Block>
          <Block title="Identified gaps" active={on('gaps')}>
            <div className="flex flex-wrap gap-2">
              {open.length === 0 ? <span className="text-[16px] text-dim">None below 0.50</span> : open.map((id) => (
                <span key={id} className="rounded-md px-2 py-0.5 text-[16px]" style={{ background: 'rgba(248,113,113,0.15)', color: C.gap }}>
                  {conceptById(id).symbol} {conceptById(id).label}
                </span>
              ))}
            </div>
          </Block>
        </div>
        <div className="space-y-3">
          <Block title="Learning history" active={on('history')}>
            {TWIN_HISTORY.map((h) => (
              <div key={h.when + h.text} className="flex gap-3 text-[16px]">
                <span className="w-24 shrink-0 text-dim">{h.when}</span>
                <span className="text-ink">{h.text}</span>
              </div>
            ))}
          </Block>
          <Block title="Assessment & errors" active={on('assessment') || on('errors')}>
            <div className="text-[16px] text-ink">{assessment}</div>
          </Block>
          <Block title="Activity pattern" active={on('activity')}>
            {TWIN_ACTIVITY.map((a) => <div key={a} className="text-[16px] text-ink">{a}</div>)}
          </Block>
          <Block title="Previous interventions" active={on('interventions')}>
            {TWIN_PAST_INTERVENTIONS.map((p) => (
              <div key={p.what} className="text-[16px] text-ink">{p.what} → <span className="text-dim">{p.outcome}</span></div>
            ))}
          </Block>
        </div>
      </div>
    </div>
  );
}

/** Compact twin used inside the agents' hub. */
export function TwinMini({ mastery, highlight = [], width = 420 }: { mastery: Mastery; highlight?: TwinKey[]; width?: number }) {
  return (
    <div className="rounded-2xl p-4" style={{ width, background: C.panel, border: `2px solid ${C.twin}` }}>
      <div className="mb-2 font-display text-[19px] font-bold" style={{ color: C.twin }}>Digital Twin · {MINH_ANH.short}</div>
      {TWIN_FOCUS.map((id) => <MasteryBar key={id} id={id} value={mastery[id]} active={highlight.includes(`mastery.${id}`)} />)}
    </div>
  );
}
