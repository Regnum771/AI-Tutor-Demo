/** Small phone outline used instead of an emoji, whose font varies between machines. */
export function PhoneGlyph({ color = '#FFFFFF' }: { color?: string }) {
  return <span aria-hidden className="mr-2 inline-block rounded-[3px] align-[-2px]" style={{ width: 11, height: 18, border: `2px solid ${color}` }} />;
}
