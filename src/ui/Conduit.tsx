/** A path with a faint base stroke and dashes that flow along it as a function of t. */
export function Conduit({ d, color, t, direction = 1, width = 3, opacity = 1 }: { d: string; color: string; t: number; direction?: 1 | -1; width?: number; opacity?: number }) {
  return (
    <g opacity={opacity}>
      <path d={d} stroke={color} strokeOpacity={0.25} strokeWidth={width} fill="none" />
      <path d={d} stroke={color} strokeWidth={width} fill="none" strokeDasharray="10 14" strokeDashoffset={-direction * t * 0.06} strokeLinecap="round" />
    </g>
  );
}
