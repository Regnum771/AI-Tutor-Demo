type Env = Record<string, boolean>;

/** A small parser for p, q, r formulas with ¬ ∧ ∨ → ↔ and parentheses. Throws on anything else. */
export function evalFormula(text: string, env: Env): boolean {
  const tokens = text.replace(/\s+/g, '').split('');
  let i = 0;
  const peek = () => tokens[i];
  const atom = (): boolean => {
    const t = tokens[i++];
    if (t === '¬') return !atom();
    if (t === '(') {
      const v = iff();
      if (tokens[i++] !== ')') throw new Error(`Unbalanced: ${text}`);
      return v;
    }
    if (t === undefined || !(t in env)) throw new Error(`Not a formula: ${text}`);
    return env[t];
  };
  const and = (): boolean => {
    let v = atom();
    while (peek() === '∧') { i++; const r = atom(); v = v && r; }
    return v;
  };
  const or = (): boolean => {
    let v = and();
    while (peek() === '∨') { i++; const r = and(); v = v || r; }
    return v;
  };
  const imp = (): boolean => {
    const v = or();
    if (peek() !== '→') return v;
    i++;
    const r = imp();
    return !v || r;
  };
  function iff(): boolean {
    let v = imp();
    while (peek() === '↔') { i++; const r = imp(); v = v === r; }
    return v;
  }
  const out = iff();
  if (i !== tokens.length) throw new Error(`Trailing input: ${text}`);
  return out;
}

const VALUES = [true, false];

/** Whether two formulas over p, q, r agree on every row of the truth table. */
export function sameTruth(a: string, b: string): boolean {
  for (const p of VALUES) for (const q of VALUES) for (const r of VALUES) {
    if (evalFormula(a, { p, q, r }) !== evalFormula(b, { p, q, r })) return false;
  }
  return true;
}
