import { useEffect, useState } from "react";
import { FIRST_FUTURE_YEAR, MONTHS } from "../config";
import type { ClimateState } from "../useClimate";
import Legend from "./Legend";

const PLAY_STEP_MS = 1500;

export default function TimeBar({ c }: { c: ClimateState }) {
  const [playing, setPlaying] = useState(false);
  const { year, setYear, minYear, maxYear } = c;

  useEffect(() => {
    if (!playing) return;
    if (year >= maxYear) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setYear(year + 1), PLAY_STEP_MS);
    return () => clearTimeout(t);
  }, [playing, year, maxYear, setYear]);

  const togglePlay = () => {
    if (!playing && year >= maxYear) setYear(minYear);
    setPlaying(!playing);
  };

  const pct = (y: number) => `${((y - minYear) / (maxYear - minYear)) * 100}%`;

  return (
    <div className="timebar">
      <div className="timebar-year" aria-live="off">
        <span className="year">{year}</span>
        <span className="year-context">{year < FIRST_FUTURE_YEAR ? "Simulated past" : "Projected"}</span>
      </div>

      <div className="timebar-controls">
        <div className="slider-row">
          <button className="play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play through the years"}>
            {playing ? (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <rect x="3" y="2" width="3.5" height="12" />
                <rect x="9.5" y="2" width="3.5" height="12" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 2 L14 8 L4 14 Z" />
              </svg>
            )}
          </button>
          <div className="slider">
            <input
              type="range"
              min={minYear}
              max={maxYear}
              value={year}
              onChange={(e) => {
                setPlaying(false);
                setYear(Number(e.target.value));
              }}
              aria-label="Year"
            />
            <div className="ticks" aria-hidden="true">
              {[minYear, FIRST_FUTURE_YEAR, 2050, maxYear]
                .filter((y, i, a) => a.indexOf(y) === i)
                .map((y) => (
                  <span key={y} style={{ left: pct(y) }} className={y === FIRST_FUTURE_YEAR ? "tick tick-future" : "tick"}>
                    {y}
                  </span>
                ))}
            </div>
          </div>
        </div>

        {c.layer.frequency === "mon" && (
          <div className="months" role="radiogroup" aria-label="Month">
            {MONTHS.map((m, i) => (
              <button key={m} role="radio" aria-checked={c.month === i} className={c.month === i ? "on" : ""} onClick={() => c.setMonth(i)}>
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      <Legend title={c.layer.title} colormap={c.layer.colormap} rescale={c.layer.rescale} bins={c.layer.bins} unit={c.layer.unit} />
    </div>
  );
}
