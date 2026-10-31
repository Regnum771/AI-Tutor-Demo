import type { ReactNode } from 'react';
import { GROUPS, HEATMAP, TOPICS } from '../../scenario/classroom';
import { Kpi } from '../../ui/Kpi';
import { StudentGrid } from '../../ui/StudentGrid';
import { C, masteryColor } from '../../ui/tokens';

export interface KpiValues { total: number; needSupport: number; highRisk: number }

export interface CommandFrameProps {
  t: number;
  gridMode: 'status' | 'track' | 'twin';
  highlight: number[];
  kpis: KpiValues;
  kpiExtra?: { label: string; value: number; color: string };
  labels?: Record<number, string>;
  /** Right column content (canvas coordinates; usually x ≥ 1140). */
  right: ReactNode;
  gridReveal?: number;
}

/** Shared Command Center chrome: header, KPI row, 55-learner grid, topic heatmap. */
export function CommandFrame({ t, gridMode, highlight, kpis, kpiExtra, labels, right, gridReveal = 1 }: CommandFrameProps) {
  return (
    <div className="absolute inset-0 bg-deep">
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-10" style={{ height: 88, borderBottom: `1px solid ${C.line}`, background: C.panel }}>
        <div className="flex items-center gap-5">
          <span className="font-display text-[30px] font-extrabold text-ink">Classroom Command Center</span>
          <span className="rounded-full px-4 py-1 text-[18px]" style={{ background: C.surface, color: C.dim }}>Discrete Mathematics · DM-2026 · Week 6</span>
        </div>
        <span className="rounded-full border-2 px-4 py-1 text-[18px] font-semibold" style={{ borderColor: C.gold, color: C.gold }}>Lecturer view</span>
      </div>

      <div className="absolute flex gap-20" style={{ left: 64, top: 112 }}>
        <Kpi label="Students monitored" value={kpis.total} />
        <Kpi label="Need support" value={kpis.needSupport} color={C.gold} />
        <Kpi label="High risk" value={kpis.highRisk} color={C.gap} />
        {kpiExtra && <Kpi label={kpiExtra.label} value={kpiExtra.value} color={kpiExtra.color} />}
      </div>

      <div className="absolute rounded-2xl border-2" style={{ left: 40, top: 280, width: 1080, height: 560, borderColor: C.line, background: C.panel }}>
        <div className="px-6 pt-4 font-display text-[17px] font-bold uppercase tracking-[0.14em] text-dim">Learners · 55</div>
      </div>
      <StudentGrid t={t} highlight={highlight} mode={gridMode} reveal={gridReveal} labels={labels} />

      <div className="absolute rounded-2xl border-2 px-6 py-4" style={{ left: 40, top: 860, width: 1080, height: 190, borderColor: C.line, background: C.panel }}>
        <div className="font-display text-[17px] font-bold uppercase tracking-[0.14em] text-dim">Topic mastery by tutorial group</div>
        <div className="mt-3 flex gap-3">
          {TOPICS.map((topic, ti) => (
            <div key={topic} style={{ width: 166 }}>
              <div className="truncate text-[16px] text-ink">{topic}</div>
              <div className="mt-2 flex gap-1">
                {GROUPS.map((g, gi) => (
                  <span key={g} className="rounded" style={{ width: 30, height: 30, background: masteryColor(HEATMAP[ti][gi]), opacity: 0.35 + 0.65 * HEATMAP[ti][gi] }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {right}
    </div>
  );
}
