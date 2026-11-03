import { MONTHS } from "../config";
import type { ClimateState } from "../useClimate";

const W = 320;
const H = 150;
const PAD = { top: 12, right: 8, bottom: 22, left: 40 };

/** One year of a clicked spot's daily values, with the day on the map marked. */
export default function SeriesChart({ c }: { c: ClimateState }) {
  const { series, unit, year, month, day } = c;
  if (!c.probe) return <p className="hint">Click a spot on the map to chart its daily values for {year}.</p>;
  if (!series || series.status === "loading") return <p className="note">Loading this spot's daily values…</p>;
  if (series.status === "error") return <p className="error">Couldn't load this spot's values. Try another spot.</p>;

  // This year's values, converted for display
  const points: { t: number; v: number }[] = [];
  series.times.forEach((iso, i) => {
    const raw = series.values[i];
    if (!iso.startsWith(`${year}-`) || raw === null || !Number.isFinite(raw)) return;
    points.push({ t: Date.parse(`${iso.slice(0, 10)}T00:00:00Z`), v: unit.convert(raw) });
  });
  if (!points.length) return <p className="note">No values here for {year}. Try another spot or year.</p>;

  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const values = points.map((p) => p.v);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (t: number) => PAD.left + ((t - start) / (end - start)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom);

  const selected = Date.UTC(year, month, day);
  const selectedPoint = points.find((p) => p.t === selected);
  const fmt = (v: number) => `${v.toFixed(unit.digits)} ${unit.label}`;

  return (
    <figure className="series">
      <figcaption>
        {c.layer.title}, each day of {year}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${c.layer.title} in ${year}: from ${fmt(lo)} to ${fmt(hi)}`}>
        <text className="series-axis" x={PAD.left - 4} y={y(hi) + 4} textAnchor="end">
          {hi.toFixed(unit.digits)}
        </text>
        <text className="series-axis" x={PAD.left - 4} y={y(lo) + 4} textAnchor="end">
          {lo.toFixed(unit.digits)}
        </text>
        {MONTHS.map((m, i) => (
          <text key={m} className="series-axis" x={x(Date.UTC(year, i, 15))} y={H - 6} textAnchor="middle">
            {m[0]}
          </text>
        ))}
        <polyline className="series-line" points={points.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")} />
        {selectedPoint && (
          <>
            <line className="series-marker" x1={x(selected)} x2={x(selected)} y1={PAD.top} y2={H - PAD.bottom} />
            <circle className="series-dot" cx={x(selected)} cy={y(selectedPoint.v)} r={3.5} />
          </>
        )}
      </svg>
      <p className="note">
        {selectedPoint ? `${MONTHS[month]} ${day}: ${fmt(selectedPoint.v)}. ` : ""}Range this year: {fmt(lo)} to {fmt(hi)}. Unit: {unit.label}.
      </p>
    </figure>
  );
}
