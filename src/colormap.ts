// Map colors are decided here, in the browser: the same color table drives
// both the tiles (sent to the tiler with each request) and the legend, so they
// always match. Ported from cal-adapt-de-website
// (src/components/climate-metrics-map/colormap.ts) so both sites draw
// the same data in the same colors.

import { rgb } from "d3-color";
import { interpolateRgbBasis } from "d3-interpolate";
import * as chromatic from "d3-scale-chromatic";

// Steps for layers without `bins`: fine enough to look smooth, while keeping
// tile URLs short.
const SMOOTH_STEPS = 64;

/** Palettes defined by hex anchors (light → dark), blended smoothly between
 *  them. Any other colormap name is looked up in d3-scale-chromatic. */
const HEX_COLORMAPS: Readonly<Record<string, readonly string[]>> = {
  gist_heat_r: ["#ffffff", "#ffff00", "#ff4000", "#800000", "#000000"],
  "cal-adapt-extreme-heat": ["#ffffff", "#ffff00", "#ff4000", "#7a1a78", "#140024"],
  "cal-adapt-warm-nights": ["#ffffff", "#ffc46a", "#ff5a52", "#c01f7e", "#33167a", "#070822"],
};

/** Maps t in [0, 1] to a CSS color for a hex palette or a d3/matplotlib name (e.g. "RdYlBu_r"). */
export function buildColorScale(colormap: string): (t: number) => string {
  const anchors = HEX_COLORMAPS[colormap];
  if (anchors) {
    const interpolate = interpolateRgbBasis([...anchors]);
    return (t) => rgb(interpolate(Math.min(1, Math.max(0, t)))).toString();
  }
  const name = colormap.endsWith("_r") ? colormap.slice(0, -2) : colormap;
  const key = `interpolate${name.charAt(0).toUpperCase()}${name.slice(1)}` as keyof typeof chromatic;
  const base = (chromatic[key] as (t: number) => string) ?? chromatic.interpolateInferno;
  // d3's PuOr already runs purple → orange, i.e. matplotlib's PuOr_r
  return colormap.endsWith("_r") && colormap !== "PuOr_r" ? (t) => base(1 - t) : base;
}

export function binEdges(min: number, max: number, bins: number): number[] {
  return Array.from({ length: bins + 1 }, (_, i) => min + ((max - min) * i) / bins);
}

/** One color per bin: the colormap sampled at each bin's midpoint. */
export function binColors(colormap: string, bins: number): string[] {
  const scale = buildColorScale(colormap);
  return Array.from({ length: bins }, (_, i) => scale((i + 0.5) / bins));
}

// Stand-ins for -/+ infinity (JSON has no Infinity), so the first and last
// steps also catch values outside the range.
const BELOW_RANGE = -1e12;
const ABOVE_RANGE = 1e12;

/** The tiler's "intervals" colormap as JSON: one `[[from, to], rgba]` row per step, in the data's units. */
export function buildColorTable(colormap: string, [min, max]: [number, number], bins = SMOOTH_STEPS): string {
  const edges = binEdges(min, max, bins);
  const rows = binColors(colormap, bins).map((color, i) => {
    const { r, g, b } = rgb(color);
    const from = i === 0 ? BELOW_RANGE : edges[i];
    const to = i === bins - 1 ? ABOVE_RANGE : edges[i + 1];
    return [[from, to], [Math.round(r), Math.round(g), Math.round(b), 255]];
  });
  return JSON.stringify(rows);
}

/** CSS gradient for the legend: hard stops when binned, smooth otherwise. */
export function legendGradient(colormap: string, bins?: number): string {
  if (bins) {
    const colors = binColors(colormap, bins);
    const stops = colors.flatMap((c, i) => [`${c} ${(i / bins) * 100}%`, `${c} ${((i + 1) / bins) * 100}%`]);
    return `linear-gradient(to right, ${stops.join(", ")})`;
  }
  const scale = buildColorScale(colormap);
  const stops = Array.from({ length: 11 }, (_, i) => scale(i / 10));
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
