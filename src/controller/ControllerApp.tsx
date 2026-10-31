import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyCommand, countdown, formatTime, initialState, isDone, localTime, togglePlay,
  type Command, type PlaybackState, type Toggles,
} from '../engine/playback';
import { openChannel, type AppName, type Channel } from '../engine/sync';
import { useNow } from '../engine/useNow';
import { SCENES, TOTAL_MS, sceneById } from '../scenario/scenes';

const TOGGLE_LABELS: Record<keyof Toggles, string> = { titles: 'Titles', footer: 'Footer label', cursor: 'Cursor', chapter: 'Chapter label', tc: 'Timecode', sage: 'Sage theme' };
const STANDALONE = [
  { label: 'Copy phone Sc7 autoplay URL', path: '/student.html?scene=7&autoplay' },
  { label: 'Copy teacher Sc1 autoplay URL', path: '/teacher.html?scene=1&autoplay' },
];

const btn = 'rounded-lg border border-line bg-surface px-4 py-2 text-[15px] font-semibold text-ink hover:border-dim';

export function ControllerApp() {
  const [state, setState] = useState<PlaybackState>(() => initialState(1));
  const [playAll, setPlayAll] = useState(false);
  const [seen, setSeen] = useState<Record<AppName, number>>({ teacher: 0, student: 0 });
  const chRef = useRef<Channel | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const now = useNow();

  useEffect(() => {
    const ch = openChannel();
    chRef.current = ch;
    const off = ch.subscribe((m) => {
      if (m.kind === 'hello') ch.post({ kind: 'state', state: stateRef.current });
      if (m.kind === 'heartbeat') setSeen((s) => ({ ...s, [m.app]: m.at }));
    });
    return () => {
      off();
      ch.close();
    };
  }, []);

  useEffect(() => {
    chRef.current?.post({ kind: 'state', state });
  }, [state]);

  const send = useCallback((cmd: Command) => setState((s) => applyCommand(s, cmd, Date.now())), []);

  const scene = sceneById(state.scene);

  useEffect(() => {
    if (!playAll || !state.playing || !isDone(state, now, scene.durationMs)) return;
    if (state.scene < SCENES.length) send({ type: 'start', scene: state.scene + 1, preroll: false });
    else setPlayAll(false);
  }, [now, playAll, state, scene.durationMs, send]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.target instanceof HTMLInputElement) return;
      const s = stateRef.current;
      if (e.code === 'Space') {
        e.preventDefault();
        send(togglePlay(s));
      } else if (e.key === 'ArrowRight') {
        setPlayAll(false);
        send({ type: 'select', scene: Math.min(SCENES.length, s.scene + 1) });
      } else if (e.key === 'ArrowLeft') {
        setPlayAll(false);
        send({ type: 'select', scene: Math.max(1, s.scene - 1) });
      } else if (e.key.toLowerCase() === 'r') {
        setPlayAll(false);
        send({ type: 'start', scene: s.scene });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [send]);

  const t = localTime(state, now, scene.durationMs);
  const cd = countdown(state, now);
  const alive = (app: AppName) => now - seen[app] < 2500;

  return (
    <div className="flex h-screen gap-6 overflow-auto bg-deep p-6 font-sans text-ink">
      <div className="w-[380px] shrink-0 space-y-1">
        <div className="mb-3 font-display text-[22px] font-extrabold">Beyond AI Tutoring · Director</div>
        {SCENES.map((s) => {
          const active = s.id === state.scene;
          return (
            <button
              key={s.id}
              onClick={() => { setPlayAll(false); send({ type: 'select', scene: s.id }); }}
              className="relative block w-full overflow-hidden rounded-lg border px-3 py-2 text-left"
              style={{ borderColor: active ? '#F5B942' : '#22355E', background: active ? '#13244A' : 'transparent' }}
            >
              {active && <span className="absolute bottom-0 left-0 h-1 bg-gold" style={{ width: `${(t / s.durationMs) * 100}%` }} />}
              <span className="font-mono text-[14px] text-dim">{String(s.id).padStart(2, '0')}</span>
              <span className="ml-3 text-[16px] font-semibold">{s.label}</span>
              <span className="float-right font-mono text-[14px] text-dim">{formatTime(s.durationMs)}</span>
            </button>
          );
        })}
        <div className="pt-2 font-mono text-[14px] text-dim">Total {formatTime(TOTAL_MS)}</div>
      </div>

      <div className="flex-1 space-y-6">
        <div>
          <div className="text-[15px] uppercase tracking-widest text-dim">Scene {state.scene}</div>
          <div className="font-display text-[40px] font-extrabold">{scene.label}</div>
          <div className="font-mono text-[28px]">
            {formatTime(t)} / {formatTime(scene.durationMs)}
            {cd > 0 && <span className="ml-6 text-gold">starting in {cd}…</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className={btn} onClick={() => { setPlayAll(false); send({ type: 'select', scene: Math.max(1, state.scene - 1) }); }}>⏮ Back</button>
          <button className={btn} onClick={() => send(togglePlay(state))}>{state.playing ? '⏸ Pause' : '▶ Play'}</button>
          <button className={btn} onClick={() => { setPlayAll(false); send({ type: 'start', scene: state.scene }); }}>⟲ Restart</button>
          <button className={btn} onClick={() => { setPlayAll(false); send({ type: 'select', scene: Math.min(SCENES.length, state.scene + 1) }); }}>⏭ Next</button>
          <button
            className={btn}
            onClick={() => {
              setPlayAll(true);
              send({ type: 'start', scene: 1 });
            }}
          >
            ▶▶ Play all{playAll ? ' (running)' : ''}
          </button>
        </div>

        <input
          type="range"
          className="w-full"
          min={0}
          max={scene.durationMs}
          step={100}
          value={t}
          onChange={(e) => { setPlayAll(false); send({ type: 'seek', t: Number(e.target.value) }); }}
        />

        <div className="flex flex-wrap gap-6">
          {(Object.keys(TOGGLE_LABELS) as (keyof Toggles)[]).map((k) => (
            <label key={k} className="flex items-center gap-2 text-[16px]">
              <input type="checkbox" checked={state.toggles[k]} onChange={() => send({ type: 'toggle', key: k })} />
              {TOGGLE_LABELS[k]}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[16px]">
          {(['teacher', 'student'] as AppName[]).map((app) => (
            <span key={app}>
              <span style={{ color: alive(app) ? '#4ADE80' : '#F87171' }}>{alive(app) ? '●' : '○'}</span> {app}
            </span>
          ))}
          <button className={btn} onClick={() => window.open('/teacher.html?scene=1', 'teacher', 'width=1920,height=1080')}>Open teacher window</button>
          <button className={btn} onClick={() => window.open('/student.html', 'student', 'width=390,height=844')}>Open student window</button>
        </div>

        <div className="flex flex-wrap gap-3">
          {STANDALONE.map((s) => (
            <button key={s.path} className={btn} onClick={() => void navigator.clipboard.writeText(window.location.origin + s.path)}>{s.label}</button>
          ))}
        </div>

        <div className="text-[14px] text-dim">Keys: Space play/pause · ← → scene · R restart with pre-roll. Keep all windows in this browser profile.</div>
      </div>
    </div>
  );
}
