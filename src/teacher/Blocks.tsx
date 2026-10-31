import type { Block } from './conversations';

/** Renders the first `shown` blocks; consecutive list items share one <ul>. */
export function Blocks({ blocks, shown }: { blocks: Block[]; shown: number }) {
  const visible = blocks.slice(0, Math.max(0, shown));
  const groups: Block[][] = [];
  for (const b of visible) {
    const last = groups[groups.length - 1];
    if (b.kind === 'li' && last && last[0].kind === 'li') last.push(b);
    else groups.push([b]);
  }
  return (
    <>
      {groups.map((g, i) =>
        g[0].kind === 'li' ? <ul key={i}>{g.map((b, j) => <li key={j}>{b.body}</li>)}</ul> : <p key={i}>{g[0].body}</p>,
      )}
    </>
  );
}
