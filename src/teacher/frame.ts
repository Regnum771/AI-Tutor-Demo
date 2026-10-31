import { clamp, easeInOut, lerp, prog, typed } from '../engine/anim';
import { TOPICS, type ContextId } from './conversations';
import type { AssistantMsg, LivePanel } from '../live/types';

export type View = 'chat' | 'classroom';
export type AssistantKind = 'answer' | 'approved' | 'fallback' | 'brief' | 'adapt' | 'live';

/** Far enough before any scene that every animation keyed to it has finished. */
export const PAST = -600_000;
export const GREETING = 'Good afternoon, Lam.';
const GREETING_CPS = 10;
const ROW_OFFSETS = [2500, 3100, 3700];
const TILE_COUNT = 55;
const TILE_START = 200;
const TILE_SPAN = 7000;

export type TeacherEvent =
  | { at: number; type: 'reset' }
  | { at: number; type: 'view'; view: View }
  | { at: number; type: 'greeting' }
  | { at: number; type: 'tracker'; on: boolean }
  | { at: number; type: 'tick'; q: number }
  | { at: number; type: 'type'; text: string; cps: number }
  | { at: number; type: 'send'; text: string }
  | { at: number; type: 'think'; lines: string[]; stepMs: number; title: string; sansTitle?: boolean }
  | { at: number; type: 'assistant'; kind: AssistantKind; topic?: ContextId; index?: number; blockMs: number; stamp?: string; live?: AssistantMsg }
  | { at: number; type: 'load'; topic: ContextId }
  | { at: number; type: 'panel'; id: ContextId | null; barsDelay?: number; barsMs?: number; live?: LivePanel }
  | { at: number; type: 'panelScroll'; y: number; dur: number }
  | { at: number; type: 'edit' }
  | { at: number; type: 'approve'; id: ContextId }
  | { at: number; type: 'adaptTwin' }
  | { at: number; type: 'select'; index: number | null }
  | { at: number; type: 'classroomReveal' }
  | { at: number; type: 'pulse' }
  | { at: number; type: 'adaptClass' }
  | { at: number; type: 'title'; title: string; sansTitle: boolean };

export interface FrameMsg {
  role: 'teacher' | 'assistant';
  text: string;
  kind?: AssistantKind;
  topic?: ContextId;
  index?: number;
  stamp?: string;
  /** 0→1 fade/rise. */
  appear: number;
  /** Number of blocks revealed (teacher messages: 1). */
  shown: number;
  /** Live mode: the server's message (blocks, follow-ups, panel). */
  live?: AssistantMsg;
}

export interface FramePanel {
  id: ContextId;
  appear: number;
  /** 0→1 growth of the meter bars. */
  bars: number;
  scroll: number;
  edited: boolean;
  /** 1 at the edit, fading linearly to 0 over 1000 ms. */
  editFlash: number;
  /** 0→1 blend from MASTERY_INITIAL to MASTERY_POST. */
  twin: number;
  followUp: boolean;
  /** Live mode: which live panel to show (null in scripted mode). */
  live: LivePanel | null;
}

export interface FrameClassroom {
  /** 0→1 KPI count-up. */
  kpi: number;
  /** Tiles revealed, in index order. */
  tiles: number;
  selected: number | null;
  selectAppear: number;
  /** 0..1 pulse on Minh Anh's tile (0 when not pulsing). */
  pulse: number;
  /** 0→1 blend to the post-adapt KPIs and Minh Anh's new state. */
  adapt: number;
}

export interface TeacherFrame {
  view: View;
  title: string | null;
  sansTitle: boolean;
  greeting: { chars: number; rows: number[] };
  tracker: number;
  ticks: boolean[];
  composer: string;
  messages: FrameMsg[];
  thinking: { lines: string[]; shown: number; elapsed: number } | null;
  panel: FramePanel | null;
  approved: ContextId[];
  classroom: FrameClassroom;
}

const openPanel = (id: ContextId, at: number, t: number, barsDelay = 1000, barsMs = 2000, live: LivePanel | null = null): FramePanel => ({
  id, appear: prog(t, at, 500), bars: prog(t, at + barsDelay, barsMs), scroll: 0, edited: false, editFlash: 0, twin: 0, followUp: false, live,
});

/** Folds every event with `at <= t` (in array order) into the frame shown at time t. Pure. */
export function teacherFrame(events: TeacherEvent[], t: number): TeacherFrame {
  const f: TeacherFrame = {
    view: 'chat', title: null, sansTitle: false,
    greeting: { chars: 0, rows: [0, 0, 0] },
    tracker: 0, ticks: [false, false, false, false, false],
    composer: '', messages: [], thinking: null, panel: null, approved: [],
    classroom: { kpi: 0, tiles: 0, selected: null, selectAppear: 0, pulse: 0, adapt: 0 },
  };
  let pulseAt: number | null = null;

  for (const e of events) {
    if (e.at > t) continue;
    const dt = t - e.at;
    switch (e.type) {
      case 'reset':
        f.messages = []; f.panel = null; f.thinking = null; f.title = null; f.sansTitle = false; f.composer = '';
        break;
      case 'view':
        f.view = e.view;
        break;
      case 'title':
        f.title = e.title;
        f.sansTitle = e.sansTitle;
        break;
      case 'greeting':
        f.greeting = {
          chars: Math.min(GREETING.length, Math.floor((dt / 1000) * GREETING_CPS)),
          rows: ROW_OFFSETS.map((o) => prog(t, e.at + o, 800)),
        };
        break;
      case 'tracker':
        f.tracker = e.on ? prog(t, e.at, 400) : 0;
        break;
      case 'tick':
        f.ticks = f.ticks.map((v, i) => v || i === e.q);
        break;
      case 'type':
        f.composer = typed(e.text, t, e.at, e.cps);
        break;
      case 'send':
        f.composer = '';
        f.messages = [...f.messages, { role: 'teacher', text: e.text, appear: prog(t, e.at, 300), shown: 1 }];
        break;
      case 'think':
        f.thinking = { lines: e.lines, shown: Math.min(e.lines.length, Math.floor(dt / e.stepMs) + 1), elapsed: dt };
        f.title = e.title;
        f.sansTitle = e.sansTitle ?? false;
        break;
      case 'assistant':
        f.thinking = null;
        f.messages = [...f.messages, {
          role: 'assistant', text: '', kind: e.kind, topic: e.topic, index: e.index, stamp: e.stamp, live: e.live,
          appear: prog(t, e.at, 400), shown: e.blockMs > 0 ? Math.floor(dt / e.blockMs) + 1 : Infinity,
        }];
        break;
      case 'load':
        f.thinking = null;
        f.messages = [
          { role: 'teacher', text: TOPICS[e.topic].prompt, appear: 1, shown: 1 },
          { role: 'assistant', text: '', kind: 'answer', topic: e.topic, appear: 1, shown: Infinity },
        ];
        f.title = TOPICS[e.topic].title;
        f.sansTitle = false;
        f.panel = openPanel(e.topic, e.at, t);
        break;
      case 'panel':
        f.panel = e.id === null ? null : openPanel(e.id, e.at, t, e.barsDelay, e.barsMs, e.live ?? null);
        break;
      case 'panelScroll':
        if (f.panel) f.panel = { ...f.panel, scroll: lerp(f.panel.scroll, e.y, prog(t, e.at, e.dur, easeInOut)) };
        break;
      case 'edit':
        if (f.panel) f.panel = { ...f.panel, edited: true, editFlash: 1 - clamp(dt / 1000) };
        break;
      case 'approve':
        if (!f.approved.includes(e.id)) f.approved = [...f.approved, e.id];
        break;
      case 'adaptTwin':
        if (f.panel) f.panel = { ...f.panel, twin: prog(t, e.at, 2000), followUp: dt >= 2000 };
        break;
      case 'select':
        f.classroom = { ...f.classroom, selected: e.index, selectAppear: prog(t, e.at, 300) };
        pulseAt = null;
        break;
      case 'classroomReveal':
        f.classroom = {
          ...f.classroom,
          kpi: prog(t, e.at, 2700),
          tiles: clamp(Math.floor((dt - TILE_START) / (TILE_SPAN / TILE_COUNT)) + 1, 0, TILE_COUNT),
        };
        break;
      case 'pulse':
        pulseAt = e.at;
        break;
      case 'adaptClass':
        f.classroom = { ...f.classroom, adapt: prog(t, e.at, 2500) };
        break;
    }
  }
  f.classroom = { ...f.classroom, pulse: pulseAt === null ? 0 : 0.5 - 0.5 * Math.cos((t - pulseAt) / 250) };
  return f;
}
