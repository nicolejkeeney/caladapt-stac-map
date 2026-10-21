import { legendGradient } from "../colormap";
import type { Unit } from "../config";

interface Props {
  title: string;
  colormap: string;
  rescale: [number, number];
  bins?: number;
  unit: Unit;
  signed?: boolean; // show "+" on positive values, for change maps
}

export default function Legend({ title, colormap, rescale, bins, unit, signed }: Props) {
  const fmt = (v: number) => {
    const s = unit.convert(v).toFixed(unit.digits);
    return signed && v > 0 ? `+${s}` : s;
  };
  return (
    <div className="legend" aria-label={`Color scale for ${title}`}>
      <div className="legend-bar" style={{ background: legendGradient(colormap, bins) }} />
      <div className="legend-labels">
        <span>{fmt(rescale[0])}</span>
        <span>{unit.label}</span>
        <span>{fmt(rescale[1])}{signed ? "" : "+"}</span>
      </div>
    </div>
  );
}
