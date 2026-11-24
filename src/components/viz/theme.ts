/**
 * Paleta para escenas WebGL, derivada de los tokens OKLCH de globals.css
 * (three no entiende `var(--x)`; se convierten a hex una sola vez).
 */
function oklchToHex(L: number, C: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const enc = (v: number) => {
    const c = Math.min(1, Math.max(0, v));
    const g = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(g * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${lin.map(enc).join("")}`;
}

export const COLORS = {
  background: oklchToHex(0.155, 0.008, 255),
  card: oklchToHex(0.195, 0.01, 255),
  grid: oklchToHex(0.32, 0.015, 255),
  axis: oklchToHex(0.55, 0.02, 250),
  text: oklchToHex(0.96, 0.005, 250),
  muted: oklchToHex(0.74, 0.015, 250),
  amber: oklchToHex(0.83, 0.165, 78),
  cyan: oklchToHex(0.78, 0.12, 215),
  pink: oklchToHex(0.72, 0.17, 355),
  green: oklchToHex(0.8, 0.16, 150),
  violet: oklchToHex(0.7, 0.14, 290),
  deep: oklchToHex(0.38, 0.07, 240),
  hot: oklchToHex(0.95, 0.07, 90),
} as const;

export const SERIES = [
  COLORS.amber,
  COLORS.cyan,
  COLORS.pink,
  COLORS.green,
  COLORS.violet,
] as const;

const ramp = [
  oklchToHex(0.34, 0.06, 245),
  oklchToHex(0.55, 0.1, 225),
  oklchToHex(0.78, 0.12, 200),
  oklchToHex(0.83, 0.165, 78),
  oklchToHex(0.95, 0.08, 90),
];

/** Rampa secuencial (azul acero → ámbar → crema) para t en [0,1]. */
export function heat(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1);
  return ramp[Math.round(x)];
}
export const HEAT_STOPS = ramp;
