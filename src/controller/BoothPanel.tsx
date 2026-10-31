import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

type Info = { lanUrl: string | null; offline: boolean };

const btn = 'rounded-lg border border-line bg-surface px-4 py-2 text-[15px] font-semibold text-ink hover:border-dim';

/** Booth controls in the Director: open the live teacher, reset between visitors, and the phone's QR code. */
export function BoothPanel() {
  const [info, setInfo] = useState<Info | null | 'down'>(null);
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/info').then((r) => r.json() as Promise<Info>).then(setInfo).catch(() => setInfo('down'));
  }, []);
  useEffect(() => {
    if (info && info !== 'down' && info.lanUrl) void QRCode.toDataURL(info.lanUrl, { margin: 1, width: 220 }).then(setQr);
  }, [info]);
  const reset = () => void fetch('/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
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
        </div>
        {info && info !== 'down' && info.lanUrl && <div className="mt-3 font-mono text-[13px] text-dim">{info.lanUrl}</div>}
      </div>
      {qr && <img src={qr} alt="QR code for the live phone" width={220} height={220} className="rounded-lg bg-[#FFFDF8] p-2" />}
    </section>
  );
}
