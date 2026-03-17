import Color from "color";

export function toRgba8(color: string): [number, number, number, number] {
  const parsed = Color(color);
  const [r, g, b] = parsed
    .rgb()
    .array()
    .map((v) => Math.round(v));
  const a = Math.round(parsed.alpha() * 255);
  return [r, g, b, a];
}
