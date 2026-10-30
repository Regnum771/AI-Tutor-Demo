export type ConceptId =
  | 'propositions' | 'negation' | 'conjunction' | 'disjunction' | 'implication' | 'biconditional'
  | 'truthTables' | 'expressions' | 'equivalence' | 'deMorgan' | 'equivLaws' | 'applications';

export interface Concept {
  id: ConceptId;
  label: string;
  symbol: string;
  /** Position in the 1100×560 graph viewBox (fixed, never computed). */
  x: number;
  y: number;
}

/** [prerequisite, concept] */
export type Edge = [ConceptId, ConceptId];

export const CONCEPTS: Concept[] = [
  { id: 'propositions', label: 'Propositions', symbol: 'p', x: 80, y: 280 },
  { id: 'negation', label: 'Negation', symbol: '¬', x: 270, y: 110 },
  { id: 'conjunction', label: 'Conjunction', symbol: '∧', x: 270, y: 220 },
  { id: 'disjunction', label: 'Disjunction', symbol: '∨', x: 270, y: 330 },
  { id: 'implication', label: 'Implication', symbol: '→', x: 270, y: 440 },
  { id: 'truthTables', label: 'Truth tables', symbol: 'T/F', x: 480, y: 180 },
  { id: 'expressions', label: 'Logical expressions', symbol: 'φ', x: 480, y: 300 },
  { id: 'biconditional', label: 'Biconditional', symbol: '↔', x: 480, y: 440 },
  { id: 'equivalence', label: 'Logical equivalence', symbol: '≡', x: 690, y: 300 },
  { id: 'deMorgan', label: "De Morgan's laws", symbol: 'DM', x: 870, y: 190 },
  { id: 'equivLaws', label: 'Equivalence laws', symbol: '≡L', x: 870, y: 410 },
  { id: 'applications', label: 'Applications', symbol: 'A', x: 1020, y: 300 },
];

export const EDGES: Edge[] = [
  ['propositions', 'negation'], ['propositions', 'conjunction'], ['propositions', 'disjunction'], ['propositions', 'implication'],
  ['negation', 'truthTables'], ['conjunction', 'truthTables'], ['disjunction', 'truthTables'], ['implication', 'truthTables'],
  ['negation', 'expressions'], ['conjunction', 'expressions'], ['disjunction', 'expressions'],
  ['implication', 'biconditional'],
  ['truthTables', 'equivalence'], ['expressions', 'equivalence'], ['biconditional', 'equivalence'],
  ['equivalence', 'deMorgan'], ['equivalence', 'equivLaws'],
  ['deMorgan', 'applications'], ['equivLaws', 'applications'],
];

export function conceptById(id: ConceptId): Concept {
  const c = CONCEPTS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown concept ${id}`);
  return c;
}

export const conceptIndex = (id: ConceptId): number => CONCEPTS.findIndex((c) => c.id === id);

function reachable(from: ConceptId): Set<ConceptId> {
  const seen = new Set<ConceptId>([from]);
  const stack: ConceptId[] = [from];
  while (stack.length) {
    const n = stack.pop()!;
    for (const [a, b] of EDGES) if (a === n && !seen.has(b)) { seen.add(b); stack.push(b); }
  }
  return seen;
}

/** Every edge that lies on some path from `from` to `to`. */
export function pathEdges(from: ConceptId, to: ConceptId): Edge[] {
  const down = reachable(from);
  return EDGES.filter(([a, b]) => down.has(a) && reachable(b).has(to));
}
