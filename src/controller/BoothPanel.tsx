import QRCode from 'qrcode';
import { useEffect, useState, type MouseEvent } from 'react';

type Info = { lanUrl: string | null; offline: boolean };

const btn = 'rounded-lg border border-line bg-surface px-4 py-2 text-[15px] font-semibold text-ink hover:border-dim';

/** The hosted server sends a relative link; the origin the Director is open on is the public address. */
export const resolvePhoneUrl = (link: string, origin: string): string => new URL(link, origin).href;

/** Booth controls in the Director: open the live teacher, reset between visitors, and the phone's QR code. */
export function BoothPanel() {
  const [info, setInfo] = useState<Info | null | 'down'>(null);
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/info').then((r) => { if (!r.ok) throw new Error(); return r.json() as Promise<Info>; }).then(setInfo).catch(() => setInfo('down'));
  }, []);
  const phoneUrl = info && info !== 'down' && info.lanUrl ? resolvePhoneUrl(info.lanUrl, window.location.origin) : null;
  useEffect(() => {
    if (phoneUrl) void QRCode.toDataURL(phoneUrl, { margin: 1, width: 220 }).then(setQr);
  }, [phoneUrl]);
  const [note, setNote] = useState<string | null>(null);
  const reset = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur(); // the Director's Space handler plays and pauses; a focused button would also fire
    void fetch('/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then((r) => { if (!r.ok) throw new Error(); })
      .catch(() => setInfo('down'));
  };
  const drop = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    void fetch('/api/study/simulate-drop', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(async (r) => setNote(r.ok ? 'Quiz 3 mark dropped: the phone’s plan is being rewritten.' : ((await r.json()) as { error?: string }).error ?? 'That did not work.'))
      .catch(() => setInfo('down'));
  };
  return (
    <section className="flex flex-wrap items-start gap-6 rounded-xl border border-line bg-surface p-5">
      <div>
        <div className="text-[18px] font-semibold">Live booth demo</div>
        <div className="mt-1 text-[14px] text-dim">
          {info === 'down' ? 'Booth server not running: start it with npm run booth' : info === null ? 'Checking the booth server…' : info.offline ? 'Agents offline: canned answers' : 'Agents online'}
        </div>
        <div className="mt-3 flex gap-3">
          <button className={btn} onClick={() => window.open('/teacher.html', 'live-teacher')}>Open live teacher</button>
          <button className={btn} onClick={reset}>Reset demo</button>
          <button className={btn} onClick={drop}>Simulate a Quiz 3 drop</button>
        </div>
        {note && <div className="mt-2 text-[13px] text-dim">{note}</div>}
        {phoneUrl && <div className="mt-3 font-mono text-[13px] text-dim">{phoneUrl}</div>}
      </div>
      {qr && <img src={qr} alt="QR code for the live phone" width={220} height={220} className="rounded-lg bg-[#FFFDF8] p-2" />}
    </section>
  );
}
